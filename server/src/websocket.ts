import { IncomingMessage, Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import Logger from "./utils/logger.js";
import config from "./utils/config.js";
import { TaskExecution, TaskResult, Worker } from "@deepbounty/sdk/types";
import getTaskManager from "./tasks/taskManager.js";

const logger = new Logger("WS");

// Worker information with associated WebSocket
interface WorkerWithSocket extends Worker {
  socket: WebSocket;
}

class WebSocketHandler {
  private websocketServer: WebSocketServer;
  // Map of workerId to WorkerWithSocket
  private workers: Map<number, WorkerWithSocket> = new Map();
  // Task manager instance
  private readonly taskManager = getTaskManager();

  constructor(server: Server) {
    this.websocketServer = new WebSocketServer({ server });
    this.taskManager.registerTransport({
      // List connected workers
      listWorkers: () =>
        [...this.workers.values()].map((w) => ({
          id: w.id,
          loadFactor: w.loadFactor,
          currentTasks: w.currentTasks,
          availableTools: w.availableTools,
        })),
      // Send task execution to worker
      sendTask: (workerId: number, execution: TaskExecution) => this.sendTask(workerId, execution),
      onRequeueNeeded: (executionIds: number[]) => {
        logger.warn(`Re-queueing ${executionIds.length} execution(s) after worker disconnect`);
      },
    });
  }

  public initialize() {
    logger.info("WebSocket server initialized");
    this.websocketServer.on("connection", this.handleConnection);
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
    if (workerKey !== config.get().secretWorkerKey) {
      worker.close(3000, "Invalid worker key");
      return;
    }
    // Add the new worker
    this.addWorker(worker);
  };

  // Add a new worker
  public addWorker(ws: WebSocket): void {
    // Generate a new worker ID
    const workerId = this.workers.size + 1;
    const newWorker: WorkerWithSocket = {
      id: workerId,
      currentTasks: [],
      availableTools: [],
      loadFactor: 0,
      socket: ws,
    };
    this.workers.set(workerId, newWorker);
    logger.info(`Worker ${workerId} connected. Total workers: ${this.workers.size}`);

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
          // Update load factor if provided
          worker.loadFactor = msg.loadFactor ?? worker.loadFactor;
        }
        // Assign another task if available
        this.taskManager.assignNextTask();
        break;
      }
      case "pong": {
        logger.info(`Worker ${workerId} responded to ping`);
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
      return true;
    } catch (e) {
      logger.error(
        `Failed to send task execution ${execution.executionId} to worker ${workerId}: ${(e as Error).message}`
      );
      return false;
    }
  }
}

export default WebSocketHandler;
