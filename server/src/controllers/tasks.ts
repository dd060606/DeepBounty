import getTaskManager from "@/tasks/taskManager.js";
import { getTaskTemplateService } from "@/tasks/taskTemplateService.js";
import Logger from "@/utils/logger.js";
import { Request, Response } from "express";

const logger = new Logger("Tasks");

// GET /tasks/templates - List all task templates
export async function getAllTemplates(req: Request, res: Response) {
  try {
    const templates = await getTaskTemplateService().getAllTemplates();
    res.json(
      templates.map((t) => {
        return {
          id: t.id,
          moduleId: t.moduleId,
          uniqueKey: t.uniqueKey,
          name: t.name,
          description: t.description,
          interval: t.interval,
          schedulingType: t.schedulingType,
          active: t.active,
        };
      })
    );
  } catch (error) {
    logger.error("Error fetching task templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
}

// GET /tasks/templates/:moduleId - Get templates by module ID
export async function getTemplatesByModuleId(req: Request, res: Response) {
  try {
    const { moduleId } = req.params;
    const templates = await getTaskTemplateService().getTemplatesByModule(moduleId);
    res.json(
      templates.map((t) => {
        return {
          id: t.id,
          moduleId: t.moduleId,
          uniqueKey: t.uniqueKey,
          name: t.name,
          description: t.description,
          interval: t.interval,
          schedulingType: t.schedulingType,
          active: t.active,
        };
      })
    );
  } catch (error) {
    logger.error("Error fetching templates by module ID:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
}

// PATCH /tasks/templates/:id - Update template (activation and/or interval)
export async function updateTemplate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { active, interval } = req.body;

    const updates: { active?: boolean; interval?: number } = {};
    if (active !== undefined) updates.active = active;
    if (interval !== undefined) updates.interval = interval;

    const success = await getTaskTemplateService().updateTemplate(parseInt(id), updates);

    if (!success) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Resync tasks to apply new schedule, content, or activation status
    if (active !== undefined || interval !== undefined) {
      await getTaskManager().syncTasksForTemplate(parseInt(id));
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error("Error updating template:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
}

// DELETE /tasks/templates/:id - Delete a task template (and associated scheduled tasks)
export async function deleteTemplate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const success = await getTaskManager().unregisterTaskTemplate(parseInt(id));

    if (!success) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
}

// POST /tasks/templates/:id/run - Run a task template immediately
export async function runTemplate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const success = await getTaskManager().runTemplateNow(parseInt(id));

    if (!success) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error("Error running template:", error);
    res.status(500).json({ error: "Failed to run template" });
  }
}

// POST /tasks/templates/:id/run/:targetId - Run a template for a specific target
export async function runTemplateForTarget(req: Request, res: Response) {
  try {
    const { id, targetId } = req.params;

    // Parse IDs
    const templateIdInt = parseInt(id);
    const targetIdInt = parseInt(targetId);

    logger.info(`Manually triggered template ${templateIdInt} for target ${targetIdInt}`);

    const success = await getTaskManager().runTemplateForTarget(templateIdInt, targetIdInt);

    if (!success) {
      return res.status(404).json({ error: "Template or Target not found, or not compatible" });
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error("Error running template for target:", error);
    res.status(500).json({ error: "Failed to run template" });
  }
}

// GET /tasks/targets/:targetId/task-overrides - Get target overrides
export async function getTargetOverrides(req: Request, res: Response) {
  try {
    const { targetId } = req.params;
    const overrides = await getTaskTemplateService().getTargetOverrides(parseInt(targetId));
    res.json(overrides);
  } catch (error) {
    logger.error("Error fetching target overrides:", error);
    res.status(500).json({ error: "Failed to fetch overrides" });
  }
}

// PUT /tasks/targets/:targetId/task-overrides - Batch set overrides
export async function setOverrides(req: Request, res: Response) {
  try {
    const { targetId } = req.params;
    const taskOverridesArray: { templateId: number; active: boolean }[] = req.body;

    const taskManager = getTaskManager();
    const results = await Promise.allSettled(
      taskOverridesArray.map(({ templateId, active }) =>
        taskManager.setTaskActiveForTarget(templateId, parseInt(targetId), active)
      )
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      throw new Error("Some overrides failed to set:" + failed);
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error("Error setting target overrides:", error);
    res.status(500).json({ error: "Failed to set overrides" });
  }
}

// DELETE /tasks/targets/:targetId/task-overrides - Batch remove overrides
export async function removeOverrides(req: Request, res: Response) {
  try {
    const { targetId } = req.params;
    const { templateIds } = req.body;

    const service = getTaskTemplateService();
    const results = await Promise.allSettled(
      templateIds.map((templateId: number) =>
        service.deleteTargetOverride(parseInt(targetId), templateId)
      )
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      throw new Error("Some overrides failed to delete:" + failed);
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error("Error deleting target overrides:", error);
    res.status(500).json({ error: "Failed to delete overrides" });
  }
}
