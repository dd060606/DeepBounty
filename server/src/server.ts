import app from "./app.js";
import Logger from "./utils/logger.js";
import path from "path";
import { initModules } from "./modules/loader.js";

const logger = new Logger("Server");

const PORT = 3000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  // Init modules asynchronously after server starts
  const modulesDir = path.join(process.cwd(), "modules");
  initModules(modulesDir);
});
