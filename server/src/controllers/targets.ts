import { query } from "@/utils/db.js";
import Logger from "@/utils/logger.js";
import { Request, Response } from "express";

const logger = new Logger("Targets");

// GET /targets - return an array of all targets
export function getTargets(req: Request, res: Response) {
  query("SELECT * FROM targets")
    .then((targets) => {
      res.json(targets);
    })
    .catch((error) => {
      logger.error("Error fetching targets:", error);
      res.status(500).json({ error: "Internal server error" });
    });
}

// GET /targets/full - get all targets with their subdomains and settings
export async function getTargetsFull(req: Request, res: Response) {
  try {
    const rows = await query(
      `
      SELECT
        t.*,
        -- Subdomains array
        COALESCE(sd.subdomains, '{}'::text[]) AS subdomains,
        -- Settings object
        ts.settings
      FROM targets t
      -- Join with subdomains
      LEFT JOIN LATERAL (
        SELECT array_agg(s.subdomain ORDER BY s.subdomain) AS subdomains
        FROM targets_subdomains s
        WHERE s."targetId" = t.id
      ) sd ON true
      -- Join with settings
      LEFT JOIN LATERAL (
        SELECT s.settings
        FROM targets_settings s
        WHERE s."targetId" = t.id
        ORDER BY s."targetId" DESC
        LIMIT 1
      ) ts ON true
      ORDER BY t.id
      `
    );

    res.json(rows);
  } catch (error) {
    logger.error("Error fetching targets (full):", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// POST /targets - add a new target
export function addTarget(req: Request, res: Response) {
  const { name, domain, activeScan } = req.body;

  query('INSERT INTO targets (name, domain, "activeScan") VALUES ($1, $2, $3) RETURNING *', [
    name,
    domain,
    activeScan,
  ])
    .then((result) => {
      logger.info(`Added new target: ${name} (${domain})`);
      res.status(201).json(result[0]);
    })
    .catch((error) => {
      logger.error("Error adding target:", error);
      res.status(500).json({ error: "Internal server error" });
    });
}

// PATCH /targets/:id - Edit an existing target
export function editTarget(req: Request, res: Response) {
  const { id } = req.params;
  const { name, domain, activeScan } = req.body;

  query('UPDATE targets SET name = $1, domain = $2, "activeScan" = $3 WHERE id = $4 RETURNING *', [
    name,
    domain,
    activeScan,
    id,
  ])
    .then((result) => {
      if (result.length === 0) {
        return res.status(404).json({ error: "Target not found" });
      }
      logger.info(`Updated target: ${name} (${domain})`);
      res.json(result[0]);
    })
    .catch((error) => {
      logger.error("Error updating target:", error);
      res.status(500).json({ error: "Internal server error" });
    });
}

// DELETE /targets/:id - delete an existing target
export function deleteTarget(req: Request, res: Response) {
  const { id } = req.params;

  query("DELETE FROM targets WHERE id = $1 RETURNING *", [id])
    .then((result) => {
      if (result.length === 0) {
        return res.status(404).json({ error: "Target not found" });
      }
      logger.info(`Deleted target: ${result[0].name} (${result[0].domain})`);
      res.sendStatus(200);
    })
    .catch((error) => {
      logger.error("Error deleting target:", error);
      res.status(500).json({ error: "Internal server error" });
    });
}

// GET /targets/:id/subdomains - get all subdomains for a specific target
export function getTargetSubdomains(req: Request, res: Response) {
  const { id } = req.params;

  query('SELECT subdomain FROM targets_subdomains WHERE "targetId" = $1', [id])
    .then((subdomains) => {
      res.json(subdomains.map((sd) => sd.subdomain));
    })
    .catch((error) => {
      logger.error("Error fetching subdomains:", error);
      res.status(500).json({ error: "Internal server error" });
    });
}

// POST /targets/:id/subdomains  add / edit subdomains for a specific target
export function setTargetSubdomains(req: Request, res: Response) {
  const { id } = req.params;
  // Update subdomains in the database
  query('DELETE FROM targets_subdomains WHERE "targetId" = $1', [id])
    .then(() => {
      const promises = req.body.map((sd: string) =>
        query('INSERT INTO targets_subdomains ("targetId", subdomain) VALUES ($1, $2)', [id, sd])
      );
      return Promise.all(promises);
    })
    .then(() => {
      logger.info(`Updated subdomains for target ID ${id}`);
      res.sendStatus(200);
    })
    .catch((error) => {
      logger.error("Error updating subdomains:", error);
      res.status(500).json({ error: "Internal server error" });
    });
}

// GET /targets/:id/settings - get all settings for a specific target
export function getTargetSettings(req: Request, res: Response) {
  const { id } = req.params;

  query('SELECT settings FROM targets_settings WHERE "targetId" = $1', [id])
    .then((rows) => {
      res.json(rows[0]?.settings || {});
    })
    .catch((error) => {
      logger.error("Error fetching target settings:", error);
      res.status(500).json({ error: "Internal server error" });
    });
}

// POST /targets/:id/settings - add / edit settings for a specific target
export function setTargetSettings(req: Request, res: Response) {
  const { id } = req.params;
  const settings = req.body;
  if (!settings) {
    return res.status(400).json({ error: "Settings are required" });
  }
  // Update settings in the database
  query('DELETE FROM targets_settings WHERE "targetId" = $1', [id])
    .then(() => {
      return query('INSERT INTO targets_settings ("targetId", settings) VALUES ($1, $2)', [
        id,
        settings,
      ]);
    })
    .then(() => {
      logger.info(`Updated settings for target ID ${id}`);
      res.sendStatus(200);
    })
    .catch((error) => {
      logger.error("Error updating settings:", error);
      res.status(500).json({ error: "Internal server error" });
    });
}
