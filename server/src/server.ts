import { createServer } from "http";
import Logger from "./utils/logger.js";
import WebSocketHandler from "./websocket.js";
import app from "./app.js";
import { shutdownModules } from "./modules/loader.js";
import { DnsService } from "./services/dns.js";

const logger = new Logger("Server");
const PORT = 3000;

const server = createServer(app);

// Initialize WebSocket handler
const websocketHandler = new WebSocketHandler(server);
websocketHandler.initialize();

const dnsService = new DnsService();

// Start the server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  // Start DNS Service for callbacks
  dnsService.start();
});

// Graceful shutdown handler
export const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop modules
  await shutdownModules();

  // Stop DNS Service
  dnsService.stop();

  // Give time for cleanup
  setTimeout(() => {
    logger.info("Shutdown complete");
    process.exit(0);
  }, 1000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
