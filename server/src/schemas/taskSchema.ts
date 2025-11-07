import { z } from "zod";

export const taskTemplateSchema = z.object({
  active: z.boolean(),
});

export const templateIdsSchema = z.object({
  templateIds: z.array(z.number().int().gte(1)).min(1, "At least one templateId is required"),
});
