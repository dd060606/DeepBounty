import { z } from "zod";

export const updateSettingsSchema = z.object({
  swaggerUi: z.boolean().optional(),
  restart: z.boolean().optional(),
  externalUrl: z.string().optional(),
});
