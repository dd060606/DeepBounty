import { query } from "@/utils/db.js";
import Logger from "@/utils/logger.js";

const logger = new Logger("ModuleConfig");

export interface Setting {
  name: string;
  type: "checkbox" | "text" | "select" | "info";
  default: any;
  label: string;
  value: any;
}

export class ModuleConfig {
  constructor(private moduleId: string) {}

  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    const rows = await query(
      'SELECT "value" FROM modules_configs WHERE "moduleId" = $1 AND "key" = $2 LIMIT 1',
      [this.moduleId, key]
    );
    if (!rows || rows.length === 0) return defaultValue as T;
    return rows[0].value as T;
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    await query(
      `INSERT INTO modules_configs ("moduleId", "key", "value")
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT ("moduleId", "key")
       DO UPDATE SET "value" = EXCLUDED."value"`,
      [this.moduleId, key, JSON.stringify(value)]
    );
  }

  async remove(key: string): Promise<void> {
    await query('DELETE FROM modules_configs WHERE "moduleId" = $1 AND "key" = $2', [
      this.moduleId,
      key,
    ]);
  }

  async getAll(): Promise<Record<string, any>> {
    const rows = await query('SELECT "key", "value" FROM modules_configs WHERE "moduleId" = $1', [
      this.moduleId,
    ]);
    const out: Record<string, any> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  // Settings methods (loaded from module.yml and configurable on the frontend)
  // Settings is an array of JSON objects stored under the "settings" key

  // Initialize settings (only if they don't exist yet)
  async initSettings(settings?: Setting[]): Promise<void> {
    if (!settings || settings.length === 0) {
      // If no settings provided, remove existing settings
      await this.remove("settings");
      return;
    }
    const existingSettings = (await this.get<Record<string, any>[]>("settings", [])) || [];
    const mergedSettings = [...existingSettings];

    // Add new settings that don't exist yet
    for (const s of settings) {
      if (!existingSettings.find((es) => es.name === s.name)) {
        mergedSettings.push({ ...s, value: s.default });
      }
    }

    // Remove unused settings
    for (let i = mergedSettings.length - 1; i >= 0; i--) {
      if (!settings.find((s) => s.name === mergedSettings[i].name)) {
        mergedSettings.splice(i, 1);
      }
    }
    await this.set("settings", mergedSettings);
  }

  // Get a specific setting (with its metadata)
  async getSetting(name: string): Promise<Setting | null> {
    const settings = (await this.get<Record<string, any>[]>("settings", [])) || [];
    const setting = settings.find((s) => s.name === name);
    if (!setting) {
      logger.error(`Setting with name "${name}" not found`);
      return null;
    }
    return setting as Setting;
  }

  // Update an existing setting
  async setSetting<T = any>(name: string, value: T): Promise<void> {
    const settings = (await this.get<Record<string, any>[]>("settings", [])) || [];
    const setting = settings.find((s) => s.name === name);
    if (setting) {
      setting.value = value;
      return this.set("settings", settings);
    }
    logger.error(`Setting with name "${name}" not found`);
  }

  // Get all settings (with their metadata)
  async getAllSettings(): Promise<Setting[]> {
    const settings = (await this.get<Record<string, any>[]>("settings", [])) || [];
    return settings.map((s) => ({
      name: s.name,
      type: s.type,
      default: s.default,
      label: s.label,
      value: s.value,
    }));
  }
}

// Check settings structure
export function validateSettings(settings: any): settings is Setting[] {
  if (!Array.isArray(settings)) return false;
  for (const s of settings) {
    if (!validateSingleSetting(s)) return false;
  }
  return true;
}

// Validate a single setting structure
function validateSingleSetting(setting: any): setting is Setting {
  if (typeof setting !== "object" || setting === null) return false;
  if (typeof setting.name !== "string") return false;
  if (!["checkbox", "text", "select", "info"].includes(setting.type)) return false;
  if (typeof setting.label !== "string") return false;
  if (setting.type === "checkbox" && typeof setting.default !== "boolean") return false;
  if (setting.type === "text" && typeof setting.default !== "string") return false;
  if (
    setting.type === "select" &&
    (!Array.isArray(setting.options) || typeof setting.default !== "string")
  ) {
    return false;
  }
  return true;
}
