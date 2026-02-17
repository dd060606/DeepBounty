import { sql } from "drizzle-orm";
import { query } from "@/db/database.js";
import { Target } from "@deepbounty/sdk/types";

const TARGETS_CACHE_TTL_MS = 5000;

let allTargetsCache: { expiresAt: number; value: Target[] } | null = null;
let allTargetsInFlight: Promise<Target[]> | null = null;
const targetsForTaskCache = new Map<number, { expiresAt: number; value: Target[] }>();
const targetsForTaskInFlight = new Map<number, Promise<Target[]>>();

/**
 * Fetch all targets with their subdomains, packages, and settings.
 * Shared between controllers and module SDK to avoid duplicated SQL.
 */
export async function getTargetsWithDetails(): Promise<Target[]> {
  const now = Date.now();
  if (allTargetsCache && allTargetsCache.expiresAt > now) {
    return allTargetsCache.value;
  }

  if (allTargetsInFlight) {
    return await allTargetsInFlight;
  }

  allTargetsInFlight = query<Target>(
    sql`
      SELECT
        t.*,
        -- Subdomains array (In-Scope)
        COALESCE(sd.subdomains, '{}'::text[]) AS subdomains,
        -- Out of Scope Subdomains array
        COALESCE(sd.out_of_scope_subdomains, '{}'::text[]) AS "outOfScopeSubdomains",
        -- Package names array
        COALESCE(pkg.packages, '{}'::text[]) AS "packageNames",
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
      -- Join with packages
      LEFT JOIN LATERAL (
        SELECT
          array_agg(p."packageName" ORDER BY p."packageName") AS packages
        FROM targets_packages p
        WHERE p."targetId" = t.id
      ) pkg ON true
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

  try {
    const rows = await allTargetsInFlight;
    allTargetsCache = {
      value: rows,
      expiresAt: Date.now() + TARGETS_CACHE_TTL_MS,
    };
    return rows;
  } finally {
    allTargetsInFlight = null;
  }
}

/**
 * Fetch all targets with their subdomains, packages, and settings.
 * Only targets enabled for the given task template are returned.
 */
export async function getTargetsForTask(taskTemplateId: number): Promise<Target[]> {
  const now = Date.now();
  const cached = targetsForTaskCache.get(taskTemplateId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inFlight = targetsForTaskInFlight.get(taskTemplateId);
  if (inFlight) {
    return await inFlight;
  }

  const request = query<Target>(
    sql`
      SELECT
        t.*,
        -- Subdomains array (In-Scope)
        COALESCE(sd.subdomains, '{}'::text[]) AS subdomains,
        -- Out of Scope Subdomains array
        COALESCE(sd.out_of_scope_subdomains, '{}'::text[]) AS "outOfScopeSubdomains",
        -- Package names array
        COALESCE(pkg.packages, '{}'::text[]) AS "packageNames",
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
      -- Join with packages
      LEFT JOIN LATERAL (
        SELECT
          array_agg(p."packageName" ORDER BY p."packageName") AS packages
        FROM targets_packages p
        WHERE p."targetId" = t.id
      ) pkg ON true
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

  targetsForTaskInFlight.set(taskTemplateId, request);

  try {
    const rows = await request;
    targetsForTaskCache.set(taskTemplateId, {
      value: rows,
      expiresAt: Date.now() + TARGETS_CACHE_TTL_MS,
    });
    return rows;
  } finally {
    targetsForTaskInFlight.delete(taskTemplateId);
  }
}
