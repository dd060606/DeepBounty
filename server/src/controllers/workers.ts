import { Request, Response } from "express";
import getRegistry from "@/utils/registry.js";
import WebSocketHandler from "@/websocket.js";

// GET /settings/workers - get list of connected workers
export const getWorkers = async (req: Request, res: Response) => {
  const workers = getRegistry().getAllWorkers();
  res.json(
    workers.map((w) => ({
      id: w.id,
      ip: w.ip,
      connectedAt: w.connectedAt,
      tasksCount: w.currentTasks.length,
      toolsCount: w.availableTools.length,
    }))
  );
};

// POST /workers/:id/disconnect - disconnect a worker by ID
export const disconnectWorker = async (req: Request, res: Response) => {
  const { id } = req.params;
  const workerId = parseInt(id);

  const wsHandler = WebSocketHandler.getInstance();

  const success = wsHandler?.disconnectWorker(workerId);
  if (success) {
    res.json({ success: true, message: "Worker disconnected" });
  } else {
    res.status(404).json({ error: "Worker not found or could not be disconnected" });
  }
};
