import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { query, queryOne } from "@/db/database.js";
import Logger from "@/utils/logger.js";
import config from "@/utils/config.js";
import {
  ModuleCallback,
  CallbackTriggerData,
  CallbackHandler,
  CreateCallbackOptions,
} from "@deepbounty/sdk/types";

const logger = new Logger("CallbackService");

// Store callback handlers per module (in-memory, re-registered on module load)
const callbackHandlers = new Map<string, CallbackHandler>();

// Database row type
interface CallbackRow {
  id: number;
  uuid: string;
  moduleId: string;
  name: string;
  metadata: Record<string, any>;
  allowMultipleTriggers: boolean;
  triggerCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  effectiveAt: string;
  expiresAt: string | null;
}

/**
 * Register a callback handler for a module
 * Called by modules during initialization
 */
export function registerCallbackHandler(moduleId: string, handler: CallbackHandler): void {
  callbackHandlers.set(moduleId, handler);
  logger.info(`Callback handler registered for module: ${moduleId}`);
}

/**
 * Unregister a callback handler for a module
 * Called during module cleanup
 */
export function unregisterCallbackHandler(moduleId: string): void {
  callbackHandlers.delete(moduleId);
}

/**
 * Create a new callback
 */
export async function createCallback(
  moduleId: string,
  name: string,
  metadata: Record<string, any> = {},
  options: CreateCallbackOptions = {}
): Promise<{ uuid: string; url: string }> {
  const uuid = randomUUID();
  const now = new Date();

  const effectiveDelay = options.effectiveIn ?? 0;
  const effectiveAt: Date =
    effectiveDelay > 0 ? new Date(now.getTime() + effectiveDelay * 1000) : now;

  let expiresAt: Date | null = null;
  if (options.expiresIn && options.expiresIn > 0) {
    expiresAt = new Date(now.getTime() + options.expiresIn * 1000);
  }

  const allowMultipleTriggers = options.allowMultipleTriggers ?? true;
  const metadataJson = JSON.stringify(metadata);

  await queryOne(
    sql`INSERT INTO module_callbacks (uuid, "moduleId", name, metadata, "allowMultipleTriggers", "createdAt", "effectiveAt", "expiresAt")
          VALUES (${uuid}, ${moduleId}, ${name}, ${metadataJson}::jsonb, ${allowMultipleTriggers}, ${now.toISOString()}, ${effectiveAt.toISOString()}, ${expiresAt?.toISOString() ?? null})`
  );

  const externalUrl = config.get().externalUrl || "";
  const url = `${externalUrl}/cb/${uuid}`;

  logger.info(`Callback created: ${name} (${uuid}) for module ${moduleId}`);

  return { uuid, url };
}

/**
 * Get a callback by UUID (for a specific module)
 */
export async function getCallback(moduleId: string, uuid: string): Promise<ModuleCallback | null> {
  const row = await queryOne<CallbackRow>(
    sql`SELECT id, uuid, "moduleId", name, metadata, 
                "allowMultipleTriggers", 
                "triggerCount",
                "lastTriggeredAt", 
                  "createdAt", 
                  "effectiveAt", 
                "expiresAt"
        FROM module_callbacks 
        WHERE uuid = ${uuid} AND "moduleId" = ${moduleId}`
  );

  if (!row) return null;

  return mapToModuleCallback(row);
}

/**
 * Get a callback by UUID (any module - used by trigger endpoint)
 */
export async function getCallbackByUuid(
  uuid: string
): Promise<(ModuleCallback & { id: number }) | null> {
  const row = await queryOne<CallbackRow>(
    sql`SELECT id, uuid, "moduleId", name, metadata, 
               "allowMultipleTriggers", 
               "triggerCount",
               "lastTriggeredAt", 
                 "createdAt", 
                 "effectiveAt", 
               "expiresAt"
        FROM module_callbacks 
        WHERE uuid = ${uuid}`
  );

  if (!row) return null;

  return { ...mapToModuleCallback(row), id: row.id };
}

/**
 * List all callbacks for a module
 */
export async function listCallbacks(
  moduleId: string,
  includeExpired: boolean = false
): Promise<ModuleCallback[]> {
  const now = new Date().toISOString();

  let rows: CallbackRow[];
  if (includeExpired) {
    rows = await query<CallbackRow>(
      sql`SELECT id, uuid, "moduleId", name, metadata, 
                 "allowMultipleTriggers", 
                 "triggerCount",
                 "lastTriggeredAt", 
                 "createdAt", 
                 "effectiveAt", 
                 "expiresAt"
          FROM module_callbacks 
          WHERE "moduleId" = ${moduleId}`
    );
  } else {
    rows = await query<CallbackRow>(
      sql`SELECT id, uuid, "moduleId", name, metadata, 
                 "allowMultipleTriggers", 
                 "triggerCount",
                 "lastTriggeredAt", 
                 "createdAt", 
                 "effectiveAt", 
                 "expiresAt"
          FROM module_callbacks 
          WHERE "moduleId" = ${moduleId} AND ("expiresAt" IS NULL OR "expiresAt" > ${now})`
    );
  }

  return rows.map(mapToModuleCallback);
}

/**
 * Delete a callback by UUID
 */
export async function deleteCallback(moduleId: string, uuid: string): Promise<boolean> {
  const result = await queryOne<{ count: number }>(
    sql`WITH deleted AS (
          DELETE FROM module_callbacks 
          WHERE uuid = ${uuid} AND "moduleId" = ${moduleId}
          RETURNING 1
        ) SELECT count(*)::int as count FROM deleted`
  );

  return (result?.count ?? 0) > 0;
}

/**
 * Delete all callbacks for a module
 */
export async function deleteAllCallbacks(moduleId: string): Promise<number> {
  const result = await queryOne<{ count: number }>(
    sql`WITH deleted AS (
          DELETE FROM module_callbacks 
          WHERE "moduleId" = ${moduleId}
          RETURNING 1
        ) SELECT count(*)::int as count FROM deleted`
  );

  return result?.count ?? 0;
}

/**
 * Trigger a callback - called by the public /cb/:uuid endpoint
 */
export async function triggerCallback(
  uuid: string,
  triggerData: CallbackTriggerData
): Promise<{ success: boolean; error?: string }> {
  // Find the callback
  const callback = await getCallbackByUuid(uuid);

  if (!callback) {
    logger.warn(`Callback not found: ${uuid}`);
    return { success: false, error: "Callback not found" };
  }

  const now = new Date();

  // Check if expired
  if (callback.expiresAt && new Date(callback.expiresAt) < now) {
    return { success: false, error: "Callback expired" };
  }

  // Check if callback is active yet
  if (callback.effectiveAt && new Date(callback.effectiveAt) > now) {
    return { success: false, error: "Callback not active yet" };
  }

  // Check if already triggered and multiple triggers not allowed
  if (!callback.allowMultipleTriggers && callback.triggerCount > 0) {
    return { success: false, error: "Callback already triggered" };
  }

  // Update trigger count and last triggered time
  await queryOne(
    sql`UPDATE module_callbacks 
        SET "triggerCount" = "triggerCount" + 1, "lastTriggeredAt" = ${now.toISOString()}
        WHERE id = ${callback.id}`
  );

  // Find the module's callback handler
  const handler = callbackHandlers.get(callback.moduleId);

  if (!handler) {
    logger.warn(`No callback handler registered for module: ${callback.moduleId}`);
    // Still return success - the callback was recorded, just no handler to process it
    return { success: true };
  }

  // Update the callback object with the new trigger count
  const updatedCallback: ModuleCallback = {
    ...callback,
    triggerCount: callback.triggerCount + 1,
    lastTriggeredAt: now.toISOString(),
  };

  // Invoke the handler asynchronously (don't block the HTTP response)
  setImmediate(async () => {
    try {
      await handler(updatedCallback, triggerData);
    } catch (error) {
      logger.error(
        `Error in callback handler for ${callback.moduleId}: ${(error as Error).message}`
      );
    }
  });

  return { success: true };
}

/**
 * Helper to map DB row to ModuleCallback
 */
function mapToModuleCallback(row: CallbackRow): ModuleCallback {
  return {
    uuid: row.uuid,
    moduleId: row.moduleId,
    name: row.name,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt,
    effectiveAt: row.effectiveAt,
    expiresAt: row.expiresAt,
    allowMultipleTriggers: row.allowMultipleTriggers,
    triggerCount: row.triggerCount,
    lastTriggeredAt: row.lastTriggeredAt,
  };
}

/**
 * Cleanup expired callbacks (can be called periodically)
 */
export async function cleanupExpiredCallbacks(): Promise<number> {
  const now = new Date().toISOString();
  const result = await queryOne<{ count: number }>(
    sql`WITH deleted AS (
          DELETE FROM module_callbacks 
          WHERE "expiresAt" IS NOT NULL AND "expiresAt" < ${now}
          RETURNING 1
        ) SELECT count(*)::int as count FROM deleted`
  );

  const count = result?.count ?? 0;
  if (count > 0) {
    logger.info(`Cleaned up ${count} expired callbacks`);
  }
  return count;
}
