import { z } from "zod";
import { isValidSubdomainEntry } from "@/utils/domains.js";

export const addAlertSchema = z.object({
  targetId: z.coerce.number({ message: "Invalid Target ID format" }).int().gte(1),
  name: z.string().trim().min(1, { message: "Name is required" }),
  subdomain: z
    .string()
    .refine((s) => isValidSubdomainEntry(s), { message: "Invalid subdomain format" }),
  score: z.coerce.number().int().min(0).max(4),
  confirmed: z.boolean().optional(),
  description: z.string().trim().min(1, { message: "Description is required" }),
  endpoint: z.string().trim().min(1, { message: "Endpoint is required" }),
});

export type AddAlertInput = z.infer<typeof addAlertSchema>;
