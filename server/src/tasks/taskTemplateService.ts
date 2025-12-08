import { sql } from "drizzle-orm";
import { TaskContent, TargetTaskOverride, TaskTemplate } from "@deepbounty/sdk/types";
import { query, queryOne } from "@/db/database.js";
/**
 * Service for managing task templates in the database
 */
export class TaskTemplateService {
  /**
   * Create a new task template or update if it already exists
   * Uses uniqueKey to prevent duplicates on restart
   * Preserves user-customized interval unless the module's default interval changes
   */
  async createTemplate(
    moduleId: string,
    uniqueKey: string,
    name: string,
    description: string | undefined,
    content: TaskContent,
    interval: number,
    schedulingType: "TARGET_BASED" | "GLOBAL" | "CUSTOM" = "TARGET_BASED"
  ): Promise<number> {
    // Check if template already exists
    const existing = await this.getTemplateByUniqueKey(moduleId, uniqueKey);

    if (existing) {
      // Update existing template (preserve active status and overrides)
      // Only update interval if it matches the current module default,
      // meaning user hasn't customized it
      const shouldUpdateInterval = existing.interval === interval;

      if (shouldUpdateInterval) {
        await query(sql`
          UPDATE task_templates 
          SET name = ${name}, 
              description = ${description}, 
              content = ${JSON.stringify(content)}, 
              interval = ${interval},
              "schedulingType" = ${schedulingType}
          WHERE id = ${existing.id}
        `);
      } else {
        // Preserve customized interval
        await query(sql`
          UPDATE task_templates 
          SET name = ${name}, 
              description = ${description}, 
              content = ${JSON.stringify(content)},
              "schedulingType" = ${schedulingType}
          WHERE id = ${existing.id}
        `);
      }
      return existing.id;
    }

    // Create new template
    const result = await queryOne<{ id: number }>(
      sql`INSERT INTO task_templates ("moduleId", "uniqueKey", name, description, content, interval, "schedulingType", active) 
      VALUES (${moduleId}, ${uniqueKey}, ${name}, ${description}, ${JSON.stringify(content)}, ${interval}, ${schedulingType}, true) 
      RETURNING id`
    );

    return result.id;
  }

  /**
   * Get a task template by its unique key
   */
  async getTemplateByUniqueKey(
    moduleId: string,
    uniqueKey: string
  ): Promise<TaskTemplate | undefined> {
    const template = await queryOne<TaskTemplate>(sql`
      SELECT * FROM task_templates 
      WHERE "moduleId" = ${moduleId} AND "uniqueKey" = ${uniqueKey}
    `);

    if (!template) return undefined;
    return {
      id: template.id,
      moduleId: template.moduleId,
      uniqueKey: template.uniqueKey,
      name: template.name,
      description: template.description ?? undefined,
      content: template.content as TaskContent,
      interval: template.interval,
      schedulingType: template.schedulingType || "TARGET_BASED",
      active: template.active,
    };
  }

  /**
   * Get a task template by ID
   */
  async getTemplate(id: number): Promise<TaskTemplate | undefined> {
    const template = await queryOne<TaskTemplate>(
      sql`SELECT * FROM task_templates WHERE id = ${id}`
    );

    if (!template) return undefined;
    return {
      id: template.id,
      moduleId: template.moduleId,
      uniqueKey: template.uniqueKey,
      name: template.name,
      description: template.description ?? undefined,
      content: template.content as TaskContent,
      interval: template.interval,
      schedulingType: template.schedulingType || "TARGET_BASED",
      active: template.active,
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
      schedulingType: template.schedulingType || "TARGET_BASED",
      active: template.active,
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
      schedulingType: template.schedulingType || "TARGET_BASED",
      active: template.active,
    }));
  }

  /**
   * Update a task template's global activation status
   */
  async setTemplateActive(id: number, active: boolean): Promise<boolean> {
    const result = await queryOne<{ id: number }>(
      sql`UPDATE task_templates SET active = ${active} WHERE id = ${id} RETURNING id`
    );

    return !!result;
  }

  /**
   * Update a task template's interval
   */
  async setTemplateInterval(id: number, interval: number): Promise<boolean> {
    const result = await queryOne<{ id: number }>(
      sql`UPDATE task_templates SET interval = ${interval} WHERE id = ${id} RETURNING id`
    );

    return !!result;
  }

  /**
   * Update a task template's active status and/or interval
   */
  async updateTemplate(
    id: number,
    updates: { active?: boolean; interval?: number }
  ): Promise<boolean> {
    if (updates.active === undefined && updates.interval === undefined) {
      return false; // No updates provided
    }

    // Build query dynamically based on what needs updating
    if (updates.active !== undefined && updates.interval !== undefined) {
      const result = await queryOne<{ id: number }>(
        sql`UPDATE task_templates SET active = ${updates.active}, interval = ${updates.interval} WHERE id = ${id} RETURNING id`
      );
      return !!result;
    } else if (updates.active !== undefined) {
      const result = await queryOne<{ id: number }>(
        sql`UPDATE task_templates SET active = ${updates.active} WHERE id = ${id} RETURNING id`
      );
      return !!result;
    } else if (updates.interval !== undefined) {
      const result = await queryOne<{ id: number }>(
        sql`UPDATE task_templates SET interval = ${updates.interval} WHERE id = ${id} RETURNING id`
      );
      return !!result;
    }

    return false;
  }

  /**
   * Delete a task template
   */
  async deleteTemplate(id: number): Promise<boolean> {
    const result = await queryOne<{ id: number }>(
      sql`DELETE FROM task_templates WHERE id = ${id} RETURNING id`
    );

    return !!result;
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
    const override = await queryOne<TargetTaskOverride>(sql`
      SELECT * FROM target_task_overrides WHERE "targetId" = ${targetId} AND "taskTemplateId" = ${taskTemplateId}
    `);

    if (!override) return undefined;
    return {
      id: override.id,
      targetId: override.targetId,
      taskTemplateId: override.taskTemplateId,
      active: override.active,
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
    const override = await queryOne<TargetTaskOverride>(sql`
      INSERT INTO target_task_overrides ("targetId", "taskTemplateId", active)
      VALUES (${targetId}, ${taskTemplateId}, ${active})
      RETURNING *
    `);
    return {
      id: override.id,
      targetId: override.targetId,
      taskTemplateId: override.taskTemplateId,
      active: override.active,
    };
  }

  /**
   * Delete a target-specific override
   */
  async deleteTargetOverride(targetId: number, taskTemplateId: number): Promise<boolean> {
    const result = await queryOne(sql`
        DELETE FROM target_task_overrides
        WHERE "targetId" = ${targetId} AND "taskTemplateId" = ${taskTemplateId}
        RETURNING id
      `);

    return !!result;
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

  /**
   * Delete all task templates and overrides from the database
   */
  async clearAllTemplatesAndOverrides(): Promise<void> {
    await query(sql`DELETE FROM target_task_overrides`);
    await query(sql`DELETE FROM task_templates`);
  }
}

let instance: TaskTemplateService | null = null;

export function getTaskTemplateService(): TaskTemplateService {
  if (!instance) {
    instance = new TaskTemplateService();
  }
  return instance;
}
