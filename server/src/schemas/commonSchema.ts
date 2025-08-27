import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number({ message: "Invalid ID format" }).int().gte(1),
});
