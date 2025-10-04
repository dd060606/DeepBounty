import { createServer } from "http";
import app from "./app.js";
import Logger from "./utils/logger.js";
import WebSocketHandler from "./websocket.js";

const logger = new Logger("Server");

const PORT = 3000;

const server = createServer(app);
// Initialize WebSocket handler
const websocketHandler = new WebSocketHandler(server);
websocketHandler.initialize();

// Start the HTTP server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
