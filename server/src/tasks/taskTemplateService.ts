import { sql } from "drizzle-orm";
import { TaskContent, TargetTaskOverride, TaskTemplate } from "@deepbounty/sdk/types";
import { query } from "@/utils/db.js";
/**
 * Service for managing task templates in the database
 */
export class TaskTemplateService {
  /**
   * Create a new task template or update if it already exists
   * Uses uniqueKey to prevent duplicates on restart
   */
  async createTemplate(
    moduleId: string,
    uniqueKey: string,
    name: string,
    description: string | undefined,
    content: TaskContent,
    interval: number
  ): Promise<number> {
    // Check if template already exists
    const existing = await this.getTemplateByUniqueKey(moduleId, uniqueKey);

    if (existing) {
      // Update existing template (preserve active status and overrides)
      await query(sql`
        UPDATE task_templates 
        SET name = ${name}, 
            description = ${description}, 
            content = ${JSON.stringify(content)}, 
            interval = ${interval}
        WHERE id = ${existing.id}
      `);
      return existing.id;
    }

    // Create new template
    const result = await query<{ id: number }>(
      sql`INSERT INTO task_templates ("moduleId", "uniqueKey", name, description, content, interval, active) 
      VALUES (${moduleId}, ${uniqueKey}, ${name}, ${description}, ${JSON.stringify(content)}, ${interval}, true) 
      RETURNING id`
    );

    return result[0].id;
  }

  /**
   * Get a task template by its unique key
   */
  async getTemplateByUniqueKey(
    moduleId: string,
    uniqueKey: string
  ): Promise<TaskTemplate | undefined> {
    const result = await query<TaskTemplate>(sql`
      SELECT * FROM task_templates 
      WHERE "moduleId" = ${moduleId} AND "uniqueKey" = ${uniqueKey}
    `);

    if (result.length === 0) return undefined;

    const template = result[0];
    return {
      id: template.id,
      moduleId: template.moduleId,
      uniqueKey: template.uniqueKey,
      name: template.name,
      description: template.description ?? undefined,
      content: template.content as TaskContent,
      interval: template.interval,
      active: template.active,
      createdAt: new Date(template.createdAt),
    };
  }

  /**
   * Get a task template by ID
   */
  async getTemplate(id: number): Promise<TaskTemplate | undefined> {
    const result = await query<TaskTemplate>(sql`SELECT * FROM task_templates WHERE id = ${id}`);

    if (result.length === 0) return undefined;

    const template = result[0];
    return {
      id: template.id,
      moduleId: template.moduleId,
      uniqueKey: template.uniqueKey,
      name: template.name,
      description: template.description ?? undefined,
      content: template.content as TaskContent,
      interval: template.interval,
      active: template.active,
      createdAt: new Date(template.createdAt),
    };
  }

  /**
   * Get all task templates
   */
  async getAllTemplates(): Promise<TaskTemplate[]> {
    const result = await query<TaskTemplate[]>(sql`SELECT * FROM task_templates`);

    return result.map((template: any) => ({
      id: template.id,
      moduleId: template.moduleId,
      uniqueKey: template.uniqueKey,
      name: template.name,
      description: template.description ?? undefined,
      content: template.content as TaskContent,
      interval: template.interval,
      active: template.active,
      createdAt: new Date(template.createdAt),
    }));
  }

  /**
   * Get task templates by module ID
   */
  async getTemplatesByModule(moduleId: string): Promise<TaskTemplate[]> {
    const result = await query<TaskTemplate[]>(sql`
      SELECT * FROM task_templates WHERE "moduleId" = ${moduleId}
    `);

    return result.map((template: any) => ({
      id: template.id,
      moduleId: template.moduleId,
      uniqueKey: template.uniqueKey,
      name: template.name,
      description: template.description ?? undefined,
      content: template.content as TaskContent,
      interval: template.interval,
      active: template.active,
      createdAt: new Date(template.createdAt),
    }));
  }

  /**
   * Update a task template's global activation status
   */
  async setTemplateActive(id: number, active: boolean): Promise<boolean> {
    const result = await query<{ id: number }>(
      sql`UPDATE task_templates SET active = ${active} WHERE id = ${id} RETURNING id`
    );

    return result.length > 0;
  }

  /**
   * Delete a task template
   */
  async deleteTemplate(id: number): Promise<boolean> {
    const result = await query<{ id: number }>(
      sql`DELETE FROM task_templates WHERE id = ${id} RETURNING id`
    );

    return result.length > 0;
  }

  /**
   * Delete all task templates for a module
   */
  async deleteTemplatesByModule(moduleId: string): Promise<number> {
    const result = await query<{ id: number }>(
      sql`DELETE FROM task_templates WHERE "moduleId" = ${moduleId} RETURNING id`
    );

    return result.length;
  }

  /**
   * Get target-specific override for a task template
   */
  async getTargetOverride(
    targetId: number,
    taskTemplateId: number
  ): Promise<TargetTaskOverride | undefined> {
    const result = await query<TargetTaskOverride>(sql`
      SELECT * FROM target_task_overrides WHERE "targetId" = ${targetId} AND "taskTemplateId" = ${taskTemplateId}
    `);

    if (result.length === 0) return undefined;

    const override = result[0];
    return {
      id: override.id,
      targetId: override.targetId,
      taskTemplateId: override.taskTemplateId,
      active: override.active,
      createdAt: new Date(override.createdAt),
    };
  }

  /**
   * Get all overrides for a target
   */
  async getTargetOverrides(targetId: number): Promise<TargetTaskOverride[]> {
    const result = await query<TargetTaskOverride>(sql`
      SELECT * FROM target_task_overrides WHERE "targetId" = ${targetId}
    `);
    return result.map((override: any) => ({
      id: override.id,
      targetId: override.targetId,
      taskTemplateId: override.taskTemplateId,
      active: override.active,
      createdAt: new Date(override.createdAt),
    }));
  }

  /**
   * Set or update a target-specific override
   */
  async setTargetOverride(
    targetId: number,
    taskTemplateId: number,
    active: boolean
  ): Promise<TargetTaskOverride> {
    // Try to update existing override
    const existing = await this.getTargetOverride(targetId, taskTemplateId);

    if (existing) {
      await query(sql`
        UPDATE target_task_overrides
        SET active = ${active}
        WHERE id = ${existing.id}`);

      return { ...existing, active };
    }

    // Create new override
    const result = await query<TargetTaskOverride>(sql`
      INSERT INTO target_task_overrides ("targetId", "taskTemplateId", active)
      VALUES (${targetId}, ${taskTemplateId}, ${active})
      RETURNING *
    `);

    const override = result[0];
    return {
      id: override.id,
      targetId: override.targetId,
      taskTemplateId: override.taskTemplateId,
      active: override.active,
      createdAt: new Date(override.createdAt),
    };
  }

  /**
   * Delete a target-specific override
   */
  async deleteTargetOverride(targetId: number, taskTemplateId: number): Promise<boolean> {
    const result = await query(sql`
        DELETE FROM target_task_overrides
        WHERE "targetId" = ${targetId} AND "taskTemplateId" = ${taskTemplateId}
        RETURNING id
      `);

    return result.length > 0;
  }

  /**
   * Check if a task is active for a specific target
   * Takes into account both global activation and target-specific overrides
   */
  async isTaskActiveForTarget(taskTemplateId: number, targetId: number): Promise<boolean> {
    const template = await this.getTemplate(taskTemplateId);
    if (!template) return false;

    // Check if globally disabled
    if (!template.active) return false;

    // Check for target-specific override
    const override = await this.getTargetOverride(targetId, taskTemplateId);
    if (override) return override.active;

    // No override, use global activation status
    return template.active;
  }

  // Get all active targets
  async getActiveTargets(): Promise<Array<{ id: number; domain: string }>> {
    const result = await query<{ id: number; domain: string }>(sql`
        SELECT id, domain FROM targets WHERE "activeScan" = true
      `);

    return result;
  }

  /**
   * Get all targets where a task should run
   * (active targets that don't have an override disabling the task)
   */
  async getTargetsForTask(taskTemplateId: number): Promise<Array<{ id: number; domain: string }>> {
    const template = await this.getTemplate(taskTemplateId);
    if (!template || !template.active) return [];

    const activeTargets = await this.getActiveTargets();
    const overrides = await query<TargetTaskOverride>(sql`
      SELECT * FROM target_task_overrides WHERE "taskTemplateId" = ${taskTemplateId}
    `);

    // Filter out targets with overrides that disable the task
    const disabledTargetIds = new Set(
      overrides
        .filter((o: TargetTaskOverride) => !o.active)
        .map((o: TargetTaskOverride) => o.targetId)
    );

    return activeTargets.filter((target) => !disabledTargetIds.has(target.id));
  }
}

let instance: TaskTemplateService | null = null;

export function getTaskTemplateService(): TaskTemplateService {
  if (!instance) {
    instance = new TaskTemplateService();
  }
  return instance;
}
