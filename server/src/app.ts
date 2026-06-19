import express from "express";
import Logger, { initLogger } from "./utils/logger.js";
import fs from "fs";
import helmet from "helmet";
import session from "express-session";
import cors from "cors";
import config, { generateRandomKey } from "./utils/config.js";
import { requireAuth } from "./middlewares/auth.js";
import { initDatabase, startPoolMonitor } from "@/db/database.js";
import { initModules } from "./modules/loader.js";
import { startAnalyticsCleanup } from "./services/analytics.js";
import { getEventMetrics } from "./events/eventMetrics.js";
import { startAlertQueue } from "./services/alertQueue.js";
import { insertAlertRow } from "./services/alerts.js";
import { startEventLoopMonitor } from "./utils/eventLoopMonitor.js";
import type { NextFunction, Request, Response } from "express";
import Setup from "./routes/setup.js";
import Auth from "./routes/auth.js";
import Targets from "./routes/targets.js";
import Alerts from "./routes/alerts.js";
import Modules from "./routes/modules.js";
import Tasks from "./routes/tasks.js";
import Settings from "./routes/settings.js";
import Workers from "./routes/workers.js";
import Notifications from "./routes/notifications.js";
import Scope from "./routes/scope.js";
import Ingest from "./routes/ingest.js";
import Callbacks from "./routes/callbacks.js";
import Analytics from "./routes/analytics.js";

// Initialize the app
function initApp() {
  initLogger();
  // Start runtime-health monitors (independent of the DB).
  startPoolMonitor();
  startEventLoopMonitor();
  // Initialize the database
  initDatabase().then(() => {
    // Once the DB is ready, initialize modules
    initModules();
    // Start the periodic retention sweep for performance analytics
    startAnalyticsCleanup();
    // Start the periodic flush of in-memory event-throughput metrics
    getEventMetrics().start();
    // Start the durable alert queue: retries any alerts that could not be
    // committed so security findings are never lost.
    startAlertQueue(async (row) => {
      await insertAlertRow(row);
    });
  });
}
initApp();

const app = express();

app.use(express.json({ limit: "50mb" }));

app.use(helmet());

app.set("trust proxy", 1);

// CORS (dev only) for Vite
if (process.env.NODE_ENV !== "production") {
  app.use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    })
  );
}

// Session
app.use(
  session({
    secret: generateRandomKey(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Init Swagger Ui if enabled
if (config.get().enableSwaggerUi) {
  (async () => {
    const [{ default: swagger }, { default: YAML }] = await Promise.all([
      import("swagger-ui-express"),
      import("yaml"),
    ]);

    app.use(
      "/docs",
      swagger.serve,
      swagger.setup(YAML.parse(fs.readFileSync("swagger.yml", "utf8")), {
        // Needed for authenticated requests
        swaggerOptions: {
          requestInterceptor: (req: any) => {
            req.credentials = "include";
            return req;
          },
          persistAuthorization: true,
        },
      })
    );
  })();
  new Logger("Server").info("Swagger UI is available at /docs");
}
// Routes
app.use("/setup", Setup);
app.use("/auth", Auth);
app.use("/targets", requireAuth, Targets);
app.use("/alerts", requireAuth, Alerts);
app.use("/modules", requireAuth, Modules);
app.use("/tasks", requireAuth, Tasks);
app.use("/settings", requireAuth, Settings);
app.use("/workers", requireAuth, Workers);
app.use("/notifications", requireAuth, Notifications);
app.use("/metrics", requireAuth, Analytics);
app.use("/scope", Scope);
app.use("/ingest", Ingest);
app.use("/cb", Callbacks); // Public callback endpoint (no auth required)

// Global error handler.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const errLogger = new Logger("HTTP");

  // Client aborted the request before the body was fully received.
  if (
    err?.type === "request.aborted" ||
    err?.code === "ECONNABORTED" ||
    err?.message === "request aborted"
  ) {
    errLogger.warn("Request aborted by client before body was fully received.");
    return;
  }

  // Malformed JSON / payload-too-large from body-parser.
  if (
    err?.type === "entity.parse.failed" ||
    err?.type === "entity.too.large" ||
    err?.status === 400
  ) {
    if (!res.headersSent) res.status(400).json({ error: "Invalid request body" });
    return;
  }

  errLogger.error("Unhandled request error:", err);
  if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
});

export default app;
