import { WebSocket } from "ws";
import { createMessageHandler } from "./taskHandler.js";
import { getInstalledTools } from "./tools.js";

const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY ?? 5);
const ENABLE_AGGRESSIVE_TASKS =
  (process.env.ENABLE_AGGRESSIVE_TASKS ?? "true").toLowerCase() === "true";

console.log(`Worker starting with max concurrency: ${MAX_CONCURRENCY}`);
console.log(`Aggressive tasks are ${ENABLE_AGGRESSIVE_TASKS ? "enabled" : "disabled"}`);

// Check for required environment variables
const wsUrl = process.env.SERVER_WS_URL;
if (!wsUrl) {
  throw new Error("Missing SERVER_WS_URL in environment variables");
}

const secretKey = process.env.SERVER_SECRET_KEY;
if (!secretKey) {
  throw new Error("Missing SERVER_SECRET_KEY in environment variables");
}

let reconnectTimer: NodeJS.Timeout | undefined;
let ws: WebSocket | undefined;

// Clear any existing reconnect timer
const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
};

// Schedule a reconnection attempt
const scheduleReconnect = (reason: string) => {
  if (reconnectTimer) {
    return;
  }

  console.warn(`Connection lost (${reason}).`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    connect();
  }, 10000);
};

const attachEventHandlers = (socket: WebSocket) => {
  const sendMessage = (type: string, payload: any) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, data: payload }));
    }
  };

  const handleMessage = createMessageHandler({ sendMessage, maxConcurrency: MAX_CONCURRENCY });

  socket.on("open", () => {
    console.log("Connected to server");
    // Send installed tools to server upon connection
    const installedTools = getInstalledTools();
    if (installedTools.length !== 0) {
      socket.send(JSON.stringify({ type: "tools:list", data: installedTools }));
    }

    // Pull-based model: announce initial capacity. Server decides what to assign.
    setTimeout(() => {
      sendMessage("worker:ready", { count: MAX_CONCURRENCY });
    }, 500);
  });

  socket.on("message", (data) => {
    // Handle incoming messages
    handleMessage(data);
  });

  socket.on("close", (code, reason) => {
    clearReconnectTimer();

    // Auth failed
    if (code === 3000) {
      console.error("Secret key rejected by server!");
      return;
    }

    const reasonText = reason?.toString() || "no reason provided";
    // Attempt to reconnect
    scheduleReconnect(`code ${code ?? "unknown"}, ${reasonText}`);
  });

  socket.on("error", (err) => {
    // Only attempt to reconnect if the socket is not already closed or closing
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      scheduleReconnect("socket error");
    }
  });
};

const connect = () => {
  clearReconnectTimer();

  ws?.removeAllListeners();

  ws = new WebSocket(wsUrl, {
    headers: {
      // Custom header for authentication
      "x-worker-key": secretKey,
      // Indicate whether aggressive tasks are enabled
      "aggressive-tasks": ENABLE_AGGRESSIVE_TASKS ? "true" : "false",
    },
  });

  attachEventHandlers(ws);
};

connect();
