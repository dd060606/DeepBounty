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
        -- Subdomains array (In-Scope)
        COALESCE(sd.subdomains, '{}'::text[]) AS subdomains,
        -- Out of Scope Subdomains array
        COALESCE(sd.out_of_scope_subdomains, '{}'::text[]) AS "outOfScopeSubdomains",
        -- Settings object
        ts.settings
      FROM targets t
      -- Join with subdomains
      LEFT JOIN LATERAL (
        SELECT 
          array_agg(s.subdomain ORDER BY s.subdomain) FILTER (WHERE s."isOutOfScope" = false) AS subdomains,
          array_agg(s.subdomain ORDER BY s.subdomain) FILTER (WHERE s."isOutOfScope" = true) AS out_of_scope_subdomains
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

/**
 * Fetch all targets with their subdomains and settings.
 * Only targets enabled for the given task template are returned.
 */
export async function getTargetsForTask(taskTemplateId: number): Promise<Target[]> {
  return await query<Target>(
    sql`
      SELECT
        t.*,
        -- Subdomains array (In-Scope)
        COALESCE(sd.subdomains, '{}'::text[]) AS subdomains,
        -- Out of Scope Subdomains array
        COALESCE(sd.out_of_scope_subdomains, '{}'::text[]) AS "outOfScopeSubdomains",
        -- Settings object
        ts.settings
      FROM task_templates tt
      JOIN targets t ON true
      LEFT JOIN target_task_overrides tto
        ON tto."targetId" = t.id
       AND tto."taskTemplateId" = tt.id
      -- Join with subdomains
      LEFT JOIN LATERAL (
        SELECT 
          array_agg(s.subdomain ORDER BY s.subdomain) FILTER (WHERE s."isOutOfScope" = false) AS subdomains,
          array_agg(s.subdomain ORDER BY s.subdomain) FILTER (WHERE s."isOutOfScope" = true) AS out_of_scope_subdomains
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
      WHERE tt.id = ${taskTemplateId}
        AND tt.active = true
        AND t."activeScan" = true
        AND COALESCE(tto.active, true) = true
      ORDER BY t.id
    `
  );
}
