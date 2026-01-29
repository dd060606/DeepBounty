import { query } from "@/db/database.js";
import Logger from "@/utils/logger.js";
import { sql } from "drizzle-orm";
import { Request, Response } from "express";

const logger = new Logger("Scope");

// In-memory scope version that increments on changes
let scopeVersion = 0;

// Increment scope version when targets change
export function incrementScopeVersion(): void {
  scopeVersion++;
}

// GET /scope/version - check if scope has changed (lightweight polling)
export async function getScopeVersion(req: Request, res: Response) {
  res.json({ version: scopeVersion });
}

// GET /scope - get all scan-enabled subdomains
export async function getScope(req: Request, res: Response) {
  try {
    const subdomains = await query<{ subdomain: string }>(
      sql`SELECT DISTINCT ts.subdomain
          FROM targets_subdomains ts
          JOIN targets t ON t.id = ts."targetId"
          WHERE t."activeScan" = true AND ts."isOutOfScope" = false
          ORDER BY ts.subdomain`
    );

    res.json({
      version: scopeVersion,
      subdomains: subdomains.map((s) => s.subdomain),
    });
  } catch (error) {
    logger.error("Error fetching scope:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
