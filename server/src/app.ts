import express from "express";
import Setup from "./routes/setup.js";
import { initLogger } from "./utils/logger.js";
import swagger from "swagger-ui-express";
import YAML from "yaml";
import fs from "fs";

const app = express();

// Init
initLogger();

app.use(express.json());

app.use(
  "/docs",
  swagger.serve,
  swagger.setup(YAML.parse(fs.readFileSync("./src/docs/swagger.yml", "utf8")))
);

// Routes
app.use("/setup", Setup);

export default app;
