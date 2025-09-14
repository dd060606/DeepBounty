import { query } from "@/utils/db.js";

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
}
