import { WebSocket } from "ws";

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
  socket.on("open", () => {
    console.log("Connected to server");
  });

  socket.on("message", (data) => {
    console.log("Received:", data.toString());
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
    console.error("WebSocket error:", err);

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
    },
  });

  attachEventHandlers(ws);
};

connect();
