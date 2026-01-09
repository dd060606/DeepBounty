import { sql } from "drizzle-orm";
import { query } from "@/db/database.js";
import { Target } from "@deepbounty/sdk/types";

/**
 * Fetch all targets with their subdomains and settings.
 * Shared between controllers and module SDK to avoid duplicated SQL.
 */
export async function getTargetsWithDetails(): Promise<Target[]> {
  return await query<Target>(
    sql`
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
}
