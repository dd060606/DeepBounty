import { createAlert } from "@/services/alerts.js";
import { query, queryOne } from "@/db/database.js";
import Logger from "@/utils/logger.js";
import { Alert } from "@deepbounty/sdk/types";
import { sql } from "drizzle-orm";
import { Request, Response } from "express";

const logger = new Logger("Alerts");

// GET /alerts - list all alerts joined with target name and domain
export async function getAlerts(req: Request, res: Response) {
  try {
    const rows = await query<Alert>(
      sql`SELECT 
        a.id,
        a.name,
        t.name AS "targetName",
        t.domain AS domain,
        a.subdomain,
        a.score,
        a.confirmed,
        a.description,
        a.endpoint,
        to_char(a."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt"
      FROM alerts a
      JOIN targets t ON t.id = a."targetId"
      ORDER BY a."createdAt" DESC, a.id DESC`
    );

    res.json(rows);
  } catch (error) {
    logger.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// POST /alerts - create a new alert
export async function addAlert(req: Request, res: Response) {
  try {
    const { targetId, name, subdomain, score, confirmed = false, description, endpoint } = req.body;
    const alert = await createAlert({
      targetId,
      name,
      subdomain,
      score,
      confirmed,
      description,
      endpoint,
    });
    res.status(201).json(alert);
  } catch (error) {
    logger.error("Error adding alert:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// DELETE /alerts/:id - delete an alert
export async function deleteAlert(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const deleted = await queryOne<{ id: number; name: string }>(
      sql`DELETE FROM alerts WHERE id = ${id} RETURNING id, name`
    );
    if (!deleted) {
      return res.status(404).json({ error: "Alert not found" });
    }
    logger.info(`Deleted alert ${deleted.id} (${deleted.name})`);
    res.sendStatus(200);
  } catch (error) {
    logger.error("Error deleting alert:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
