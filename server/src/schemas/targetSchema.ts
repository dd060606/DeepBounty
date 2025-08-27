import { z } from "zod";

export const addTargetSchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required" }),
  domain: z.string().regex(z.regexes.domain, { error: "Invalid domain format" }),
  activeScan: z.boolean().optional(),
});

export const addSubdomainsSchema = z.array(
  z.string().regex(z.regexes.domain, { error: "Invalid domain format" })
);
