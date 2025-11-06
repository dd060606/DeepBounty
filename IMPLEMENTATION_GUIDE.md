# 🚀 Guide d'implémentation - Système de tâches multi-targets

## Ce qui a été fait ✅

### 1. Base de données

- ✅ Schéma étendu avec `taskTemplates` et `targetTaskOverrides`
- ✅ Migration SQL prête (`0001_add_task_templates.sql`)

### 2. Types SDK

- ✅ Nouveaux types : `TaskTemplate`, `TargetTaskOverride`
- ✅ Types étendus : `ScheduledTask`, `TaskExecution`, `TaskResult` avec `targetId`
- ✅ Nouvelle API : `registerTaskTemplate()` / `unregisterTaskTemplate()`

### 3. Services

- ✅ `TaskTemplateService` : CRUD complet pour les templates et overrides
- ✅ Logique de synchronisation des tâches par target

### 4. Documentation

- ✅ Architecture complète documentée
- ✅ Exemples et cas d'usage

## Ce qu'il reste à faire 🔧

### Étape 3 : Créer les routes API (Priority: MEDIUM)

**Nouveau fichier** : `server/src/routes/tasks.ts`

```typescript
import { Router } from "express";
import { getTaskTemplateService } from "@/tasks/taskTemplateService.js";
import getTaskManager from "@/tasks/taskManager.js";

const router = Router();
const templateService = getTaskTemplateService();
const taskManager = getTaskManager();

// GET /api/tasks/templates - List all task templates
router.get("/templates", async (req, res) => {
	try {
		const templates = await templateService.getAllTemplates();
		res.json(templates);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch templates" });
	}
});

// PATCH /api/tasks/templates/:id - Toggle template activation
router.patch("/templates/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const { active } = req.body;

		const success = await taskManager.setTaskTemplateActive(
			parseInt(id),
			active
		);

		if (!success) {
			return res.status(404).json({ error: "Template not found" });
		}

		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: "Failed to update template" });
	}
});

// GET /api/targets/:targetId/task-overrides - Get target overrides
router.get("/:targetId/task-overrides", async (req, res) => {
	try {
		const { targetId } = req.params;
		const overrides = await templateService.getTargetOverrides(
			parseInt(targetId)
		);
		res.json(overrides);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch overrides" });
	}
});

// PUT /api/targets/:targetId/task-overrides/:templateId - Set override
router.put("/:targetId/task-overrides/:templateId", async (req, res) => {
	try {
		const { targetId, templateId } = req.params;
		const { active } = req.body;

		await taskManager.setTaskActiveForTarget(
			parseInt(templateId),
			parseInt(targetId),
			active
		);

		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: "Failed to set override" });
	}
});

// DELETE /api/targets/:targetId/task-overrides/:templateId - Remove override
router.delete("/:targetId/task-overrides/:templateId", async (req, res) => {
	try {
		const { targetId, templateId } = req.params;

		const success = await templateService.deleteTargetOverride(
			parseInt(targetId),
			parseInt(templateId)
		);

		if (!success) {
			return res.status(404).json({ error: "Override not found" });
		}

		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ error: "Failed to delete override" });
	}
});

export default router;
```

Puis dans `server/src/app.ts` :

```typescript
import tasksRoutes from "./routes/tasks.js";

// Après les autres routes
app.use("/api/tasks", tasksRoutes);
```
