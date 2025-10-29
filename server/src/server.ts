import { createServer } from "http";
import Logger from "./utils/logger.js";
import WebSocketHandler from "./websocket.js";
import TaskManager from "./tasks/taskManager.js";
import { initTaskAPI } from "./tasks/taskAPI.js";
import app from "./app.js";

const logger = new Logger("Server");
const PORT = 3000;

const server = createServer(app);

const taskManager = new TaskManager();
// Initialize Task API for modules
initTaskAPI(taskManager);

// Initialize WebSocket handler
const websocketHandler = new WebSocketHandler(server, taskManager);
websocketHandler.initialize();

// Start the server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
