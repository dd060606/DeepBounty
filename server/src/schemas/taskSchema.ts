import { z } from "zod";

export const taskTemplateSchema = z
  .object({
    active: z.boolean().optional(),
    interval: z.number().int().positive().optional(),
  })
  .refine((data) => data.active !== undefined || data.interval !== undefined, {
    message: "At least one of 'active' or 'interval' must be provided",
  });

export const taskOverridesSchema = z.array(
  z.object({
    templateId: z.number().int().gte(1),
    active: z.boolean(),
  })
);

export const templateIdsSchema = z.object({
  templateIds: z.array(z.number().int().gte(1)).min(1, "At least one templateId is required"),
});

export const taskModuleIdSchema = z.object({
  moduleId: z.string().trim().min(1, { message: "Module ID is required" }),
});
