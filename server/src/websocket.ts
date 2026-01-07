import { IncomingMessage, Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import Logger from "./utils/logger.js";
import config from "./utils/config.js";
import { TaskExecution, TaskResult, Tool, Worker } from "@deepbounty/sdk/types";
import getTaskManager from "./tasks/taskManager.js";
import getRegistry from "./utils/registry.js";
import { getMissingTools } from "./utils/taskUtils.js";

const logger = new Logger("WS");

// Worker information with associated WebSocket
interface WorkerWithSocket extends Worker {
  socket: WebSocket;
}

class WebSocketHandler {
  private static instance: WebSocketHandler | null = null;
  private websocketServer: WebSocketServer;
  // Map of workerId to WorkerWithSocket
  private workers: Map<number, WorkerWithSocket> = new Map();
  // Task manager instance
  private readonly taskManager = getTaskManager();
  // Server registry instance
  private readonly registry = getRegistry();

  constructor(server: Server) {
    WebSocketHandler.instance = this;
    this.websocketServer = new WebSocketServer({ server });
    this.taskManager.registerTransport({
      // List connected workers
      listWorkers: () =>
        [...this.workers.values()].map((w) => ({
          id: w.id,
          currentTasks: w.currentTasks,
          availableTools: w.availableTools,
        })),
      // Send task execution to worker
      sendTask: (workerId: number, execution: TaskExecution) => this.sendTask(workerId, execution),
      onRequeueNeeded: (executionIds: number[]) => {
        logger.warn(`Re-queueing ${executionIds.length} execution(s) after worker disconnect`);
      },
      updateWorkerTools: (workerId: number, tools: Tool[]) =>
        this.updateWorkerTools(workerId, tools),
    });
  }

  public initialize() {
    logger.info("WebSocket server initialized");
    this.websocketServer.on("connection", this.handleConnection);
    this.startHeartbeat();
  }

  private startHeartbeat() {
    // Send ping every 30 seconds to keep connections alive through proxies
    // This is required because load balancers (like Traefik/Nginx) often close idle connections
    setInterval(() => {
      this.workers.forEach((worker) => {
        if (worker.socket.readyState === WebSocket.OPEN) {
          try {
            worker.socket.send(JSON.stringify({ type: "ping", data: {} }));
          } catch (e) {
            logger.error(`Failed to send ping to worker ${worker.id}: ${(e as Error).message}`);
          }
        }
      });
    }, 30000);
  }

  public static getInstance(): WebSocketHandler | null {
    return WebSocketHandler.instance;
  }

  public disconnectWorker(workerId: number): boolean {
    const worker = this.workers.get(workerId);
    if (worker) {
      try {
        // Send shutdown command
        worker.socket.send(JSON.stringify({ type: "system:shutdown", data: {} }));
        // Close socket after a short delay to allow message to be sent
        setTimeout(() => {
          if (worker.socket.readyState === WebSocket.OPEN) {
            worker.socket.close(1000, "Disconnected by admin");
          }
          this.removeWorker(workerId);
        }, 100);
        return true;
      } catch (e) {
        logger.error(`Error disconnecting worker ${workerId}:`, e);
        return false;
      }
    }
    return false;
  }

  // Handle incoming connections
  private handleConnection = (worker: WebSocket, req: IncomingMessage): void => {
    const workerKey = req?.headers?.["x-worker-key"];
    // Check for a valid worker key
    if (!workerKey || Array.isArray(workerKey)) {
      worker.close(1008, "Missing x-worker-key header");
      return;
    }
    // Validate the worker key
    if (workerKey !== config.get().workerKey) {
      worker.close(3000, "Invalid worker key");
      return;
    }
    // Add the new worker
    this.addWorker(worker, this.getRemoteIp(req));
  };

  private getRemoteIp(req: IncomingMessage): string {
    // Check X-Real-IP header
    const realIp = req.headers["x-real-ip"];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Check X-Forwarded-For
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0].trim();
    }

    return req.socket.remoteAddress || "unknown";
  }

  // Add a new worker
  public addWorker(ws: WebSocket, ip?: string): void {
    // Generate a new worker ID
    const workerId = this.workers.size + 1;
    const newWorker: WorkerWithSocket = {
      id: workerId,
      currentTasks: [],
      availableTools: [],
      socket: ws,
      ip,
      connectedAt: new Date(),
    };
    this.workers.set(workerId, newWorker);
    // Sync with registry
    this.registry.registerWorker(newWorker);

    logger.info(
      `New worker connected from ${ip || "unknown"} (ID: ${workerId}). Total workers: ${this.workers.size}`
    );

    // Inform task manager
    this.taskManager.handleWorkerConnect(workerId);

    // Setup message handlers
    ws.on("message", (data: Buffer) => this.handleWorkerMessage(workerId, data.toString()));
    ws.on("close", () => this.handleWorkerClose(workerId));
    ws.on("error", (err) => {
      logger.error(`Worker ${workerId} socket error: ${(err as Error).message}`);
    });
  }

  // Remove an existing worker
  public removeWorker(workerId: number): void {
    if (this.workers.has(workerId)) {
      this.workers.delete(workerId);
      // Sync with registry
      this.registry.removeWorker(workerId);
      logger.info(`Worker ${workerId} disconnected. Total workers: ${this.workers.size}`);
    }
  }

  // Handle worker socket close
  private handleWorkerClose(workerId: number) {
    const worker = this.workers.get(workerId);
    if (worker) {
      this.removeWorker(workerId);
      // Notify task manager so it can reschedule unfinished tasks
      this.taskManager.handleWorkerDisconnect(workerId);
    }
  }

  // Parse and handle incoming worker messages
  private handleWorkerMessage(workerId: number, raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      logger.warn(`Worker ${workerId} sent invalid JSON`);
      return;
    }

    switch (msg.type) {
      case "task:result": {
        const result: TaskResult = msg.data;
        // Validate result structure
        if (!result || typeof result.executionId !== "number") {
          logger.warn(`Worker ${workerId} sent malformed task result`);
          return;
        }
        // Inform task manager
        this.taskManager.handleWorkerResult(workerId, result);
        const worker = this.workers.get(workerId);
        if (worker) {
          // Remove completed task execution from worker's current tasks
          worker.currentTasks = worker.currentTasks.filter(
            (t) => t.executionId !== result.executionId
          );
          // Sync with registry
          this.registry.updateWorker(workerId, { currentTasks: worker.currentTasks });
        }
        // Assign another task if available
        this.taskManager.assignNextTask().catch((err) => {
          logger.error(`Error assigning next task: ${err.message}`);
        });
        break;
      }
      case "tools:list": {
        // Update worker's available tools
        const tools = this.registry.findTools(msg.data as string[]);
        const worker = this.workers.get(workerId);
        if (worker) {
          worker.availableTools = tools;
          // Sync with registry
          this.registry.updateWorker(workerId, { availableTools: tools });
          logger.info(
            `Worker ${workerId} reported ${tools.length} installed tool(s): ${tools
              .map((t) => `${t.name}@${t.version}`)
              .join(", ")}`
          );
        }
        break;
      }
      case "pong": {
        break;
      }
      default:
        logger.info(`Worker ${workerId} sent unhandled message type: ${msg.type}`);
    }
  }

  // Send task execution to a worker
  private sendTask(workerId: number, execution: TaskExecution) {
    const worker = this.workers.get(workerId);
    if (!worker) return false;
    try {
      worker.socket.send(JSON.stringify({ type: "task:start", data: execution }));
      worker.currentTasks.push(execution);
      // Sync with registry
      this.registry.updateWorker(workerId, { currentTasks: worker.currentTasks });
      return true;
    } catch (e) {
      logger.error(
        `Failed to send task execution ${execution.executionId} to worker ${workerId}: ${(e as Error).message}`
      );
      return false;
    }
  }

  // Update worker installed tools (by adding new tools to the list)
  public updateWorkerTools(workerId: number, tools: Tool[]): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      // Check for tools difference before updating
      const newAddedTools = getMissingTools(worker.availableTools, tools);
      // Add only new added tools
      worker.availableTools.push(...newAddedTools);
      // Sync with registry
      this.registry.updateWorker(workerId, { availableTools: worker.availableTools });
    }
  }
}

export default WebSocketHandler;
