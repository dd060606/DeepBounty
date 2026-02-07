import { isValidDomain, isValidSubdomainEntry } from "@/utils/domains.js";
import { z } from "zod";

export const addTargetSchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required" }),
  domain: z.string().refine((s) => isValidDomain(s), {
    message: "Invalid domain format",
  }),
  activeScan: z.boolean().optional(),
});

export const addSubdomainsSchema = z.array(
  z.object({
    subdomain: z.string().refine((s) => isValidSubdomainEntry(s), {
      message: "Invalid subdomain format",
    }),
    isOutOfScope: z.boolean(),
  })
);

export const addPackagesSchema = z.array(
  z.object({
    packageName: z
      .string()
      .trim()
      .min(1, { error: "Package name is required" })
      .regex(/^[A-Za-z0-9._-]+$/, { message: "Invalid package name format" }),
  })
);
