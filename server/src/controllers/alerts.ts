import { query } from "@/utils/db.js";
import Logger from "@/utils/logger.js";
import { Request, Response } from "express";

const logger = new Logger("Alerts");

/* Shape expected by frontend
type Alert = {
  id: number;
  name: string;
  targetName: string;
  domain: string;
  subdomain: string;
  score: number;
  confirmed: boolean;
  description: string;
  endpoint: string;
  createdAt: string;
};
*/

// GET /alerts - list all alerts joined with target name and domain
export async function getAlerts(req: Request, res: Response) {
  try {
    const rows = await query<{
      id: number;
      name: string;
      targetName: string;
      domain: string;
      subdomain: string;
      score: number;
      confirmed: boolean;
      description: string;
      endpoint: string;
      createdAt: string;
    }>(
      `SELECT 
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

    const inserted = await query(
      `INSERT INTO alerts ("targetId", name, subdomain, score, confirmed, description, endpoint)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, "targetId", name, subdomain, score, confirmed, description, endpoint, "createdAt"`,
      [targetId, name, subdomain, score, confirmed, description, endpoint]
    );

    const a = inserted[0];
    // Enrich with target details for response
    const target = await query<{ name: string; domain: string }>(
      `SELECT name, domain FROM targets WHERE id = $1`,
      [a.targetId]
    );
    const t = target[0];

    res.status(201).json({
      id: a.id,
      name: a.name,
      targetName: t?.name ?? "",
      domain: t?.domain ?? "",
      subdomain: a.subdomain,
      score: a.score,
      confirmed: a.confirmed,
      description: a.description,
      endpoint: a.endpoint,
      createdAt: new Date(a.createdAt).toISOString(),
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
    const deleted = await query(`DELETE FROM alerts WHERE id = $1 RETURNING id, name`, [id]);
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
