import { z } from "zod";

export const providerParamSchema = z.object({
  provider: z.string().min(1, { message: "Invalid provider format" }),
});

export const notificationServiceSchema = z.object({
  config: z.any(),
  enabled: z.boolean(),
});
