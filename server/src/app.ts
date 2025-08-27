import express from "express";
import Logger, { initLogger } from "./utils/logger.js";
import { initDatabase } from "./utils/db.js";
import fs from "fs";
import helmet from "helmet";
import session from "express-session";
import cors from "cors";
import config from "./utils/config.js";
import { requireAuth } from "./middlewares/auth.js";
import Setup from "./routes/setup.js";
import Auth from "./routes/auth.js";
import Targets from "./routes/targets.js";
import { randomBytes } from "crypto";

const app = express();

// Init
initLogger();
initDatabase();

app.use(express.json());

app.use(helmet());

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
    secret: randomBytes(32).toString("hex"),
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
      swagger.setup(YAML.parse(fs.readFileSync("./src/docs/swagger.yml", "utf8")), {
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

export default app;
