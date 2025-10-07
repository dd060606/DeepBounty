import { query } from "@/utils/db.js";
import Logger from "@/utils/logger.js";
import { Alert } from "@deepbounty/types";
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

    const inserted = await query<Alert & { targetId: number }>(
      sql`INSERT INTO alerts ("targetId", name, subdomain, score, confirmed, description, endpoint)
       VALUES (${targetId}, ${name}, ${subdomain}, ${score}, ${confirmed}, ${description}, ${endpoint})
       RETURNING id, "targetId", name, subdomain, score, confirmed, description, endpoint, "createdAt"`
    );

    const alert = inserted[0];
    // Enrich with target details for response
    const target = await query<{ name: string; domain: string }>(
      sql`SELECT name, domain FROM targets WHERE id = ${alert.targetId}`
    );
    const t = target[0];

    logger.info(`New alert ${alert.id} (${alert.name}) for target ID ${alert.targetId}`);
    res.status(201).json({
      id: alert.id,
      name: alert.name,
      targetName: t?.name ?? "",
      domain: t?.domain ?? "",
      subdomain: alert.subdomain,
      score: alert.score,
      confirmed: alert.confirmed,
      description: alert.description,
      endpoint: alert.endpoint,
      createdAt: new Date(alert.createdAt).toISOString(),
    });
  } catch (error) {
    logger.error("Error adding alert:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// DELETE /alerts/:id - delete an alert
export async function deleteAlert(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const deleted = await query<{ id: number; name: string }>(
      sql`DELETE FROM alerts WHERE id = ${id} RETURNING id, name`
    );
    if (deleted.length === 0) {
      return res.status(404).json({ error: "Alert not found" });
    }
    logger.info(`Deleted alert ${deleted[0].id} (${deleted[0].name})`);
    res.sendStatus(200);
  } catch (error) {
    logger.error("Error deleting alert:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
