import { z } from "zod";

// Query schema for analytics endpoints: ?days=N (1..365, default applied in controller)
export const analyticsRangeSchema = z.object({
  days: z.coerce.number().int().gte(1).lte(365).optional(),
});
