import { IncomingMessage, Server } from "http";
import { WebSocketServer } from "ws";
import Logger from "./utils/logger.js";
import config from "./utils/config.js";

const logger = new Logger("WS");

class WebSocketHandler {
  private websocketServer: WebSocketServer;
  constructor(server: Server) {
    this.websocketServer = new WebSocketServer({ server });
  }

  public initialize() {
    logger.info("WebSocket server initialized");
    this.websocketServer.on("connection", this.handleConnection);
  }

  // Handle incoming connections
  private handleConnection(worker: WebSocket, req: IncomingMessage): void {
    const workerKey = req?.headers?.["x-worker-key"];
    // Check for a valid worker key
    if (!workerKey || Array.isArray(workerKey)) {
      worker.close(1008, "Missing x-worker-key header");
      return;
    }
    // Validate the worker key
    if (workerKey !== config.get().secretWorkerKey) {
      worker.close(3000, "Invalid worker key");
      return;
    }
    logger.info(`New Worker connected!`);
  }
}

export default WebSocketHandler;
