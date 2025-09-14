import app from "./app.js";
import Logger from "./utils/logger.js";

const logger = new Logger("Server");

const PORT = 3000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
