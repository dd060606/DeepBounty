import { sql } from "drizzle-orm";
import { query } from "@/db/database.js";
import { Target } from "@deepbounty/sdk/types";

// The cache is primarily invalidated explicitly when targets change.
// A long TTL avoids rebuilding the scope index every few seconds under heavy scope-check load.
const TARGETS_CACHE_TTL_MS = 60000;

let allTargetsCache: { expiresAt: number; value: Target[] } | null = null;
let allTargetsInFlight: Promise<Target[]> | null = null;
const targetsForTaskCache = new Map<number, { expiresAt: number; value: Target[] }>();
const targetsForTaskInFlight = new Map<number, Promise<Target[]>>();

/**
 * Invalidate all cached target data. Call this whenever targets, subdomains,
 * scope, settings or task overrides change so the next read reflects the change immediately.
 */
export function invalidateTargetsCache(): void {
  allTargetsCache = null;
  targetsForTaskCache.clear();
}

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

  allTargetsInFlight = (async () => {
    // 1. Fetch all targets without lateral joins
    const rawTargets = await query<any>(sql`SELECT * FROM targets ORDER BY id`);

    if (!rawTargets.length) return [];

    const targetIds = rawTargets.map((t) => t.id);

    // 2. Fetch related data using IN clauses
    const [subdomains, packages, settings] = await Promise.all([
      query<any>(sql`SELECT "targetId", subdomain, "isOutOfScope" FROM targets_subdomains`),
      query<any>(sql`SELECT "targetId", "packageName" FROM targets_packages`),
      query<any>(
        sql`SELECT DISTINCT ON ("targetId") "targetId", settings FROM targets_settings ORDER BY "targetId", id DESC`
      ),
    ]);

    // 3. Assemble data in memory
    const targetsMap = new Map<number, Target>();

    for (const t of rawTargets) {
      targetsMap.set(t.id, {
        ...t,
        subdomains: [],
        outOfScopeSubdomains: [],
        packageNames: [],
        settings: null,
      });
    }

    for (const sub of subdomains) {
      const target = targetsMap.get(sub.targetId);
      if (target) {
        if (sub.isOutOfScope) {
          target.outOfScopeSubdomains!.push(sub.subdomain);
        } else {
          target.subdomains.push(sub.subdomain);
        }
      }
    }

    for (const pkg of packages) {
      const target = targetsMap.get(pkg.targetId);
      if (target) {
        target.packageNames!.push(pkg.packageName);
      }
    }

    for (const set of settings) {
      const target = targetsMap.get(set.targetId);
      if (target) {
        target.settings = set.settings;
      }
    }

    // Sort arrays to match previous behavior
    for (const t of targetsMap.values()) {
      t.subdomains.sort();
      if (t.outOfScopeSubdomains) t.outOfScopeSubdomains.sort();
      if (t.packageNames) t.packageNames.sort();
    }

    return Array.from(targetsMap.values());
  })();

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

  const request = (async () => {
    // 1. Get all base targets (cached, avoids heavy JOIN LATERALs)
    const allTargets = await getTargetsWithDetails();

    // 2. Filter out non-active ones
    const activeTargets = allTargets.filter((t) => t.activeScan);

    // 3. Fetch template activation and overrides
    const templateInfo = await query<{ active: boolean }>(
      sql`SELECT active FROM task_templates WHERE id = ${taskTemplateId}`
    );

    // If template is disabled or doesn't exist, return empty
    if (!templateInfo.length || !templateInfo[0].active) {
      return [];
    }

    const overrides = await query<{ targetId: number; active: boolean }>(
      sql`SELECT "targetId", active FROM target_task_overrides WHERE "taskTemplateId" = ${taskTemplateId}`
    );

    const overrideMap = new Map<number, boolean>();
    for (const override of overrides) {
      overrideMap.set(override.targetId, override.active);
    }

    // 4. Return targets that are not explicitly disabled by an override
    return activeTargets.filter((target) => {
      const isExplicitlyDisabled = overrideMap.get(target.id) === false;
      return !isExplicitlyDisabled;
    });
  })();

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
