import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number({ message: "Invalid ID format" }).int().gte(1),
});

export const targetIdParamSchema = z.object({
  targetId: z.coerce.number({ message: "Invalid targetId format" }).int().gte(1),
});
