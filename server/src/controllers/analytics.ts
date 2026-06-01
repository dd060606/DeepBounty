import { getTaskTimingStats, getEventStats } from "@/services/analytics.js";
import Logger from "@/utils/logger.js";
import { Request, Response } from "express";

const logger = new Logger("Analytics");

// GET /metrics/tasks?days=7 - Per-template task execution timing statistics
export async function getTaskAnalytics(req: Request, res: Response) {
  try {
    const days = (req.query.days as unknown as number) ?? 7;
    const stats = await getTaskTimingStats(days);
    res.json(stats);
  } catch (error) {
    logger.error("Error fetching task analytics:", error);
    res.status(500).json({ error: "Failed to fetch task analytics" });
  }
}

// GET /metrics/events?days=1 - Event throughput and handler timing statistics
export async function getEventAnalytics(req: Request, res: Response) {
  try {
    const days = (req.query.days as unknown as number) ?? 1;
    const stats = await getEventStats(days);
    res.json(stats);
  } catch (error) {
    logger.error("Error fetching event analytics:", error);
    res.status(500).json({ error: "Failed to fetch event analytics" });
  }
}
