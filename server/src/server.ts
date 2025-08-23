import app from "./app.js";
import Logger from "./utils/logger.js";
import config from "./utils/config.js";

const logger = new Logger("Server");

const PORT = config.get().port;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
