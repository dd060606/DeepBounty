import { query } from "@/utils/db.js";
import Logger from "@/utils/logger.js";
import { Request, Response } from "express";

const logger = new Logger("Targets");

// Return an array of all targets
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

// Add a new target
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

// Edit an existing target
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

// Delete an existing target
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
