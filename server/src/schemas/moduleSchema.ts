import z from "zod";

export const moduleIdSchema = z.object({
  id: z.string().trim().min(1, { message: "Module ID is required" }),
});

export const moduleSettingsSchema = z.array(
  z.object({
    type: z.enum(["checkbox", "text", "select", "info"]),
    name: z.string().trim().min(1, { message: "Setting name is required" }),
    label: z.string().trim().min(1, { message: "Setting label is required" }),
    default: z.union([z.string(), z.boolean()]),
    value: z.union([z.string(), z.boolean()]).optional(),
    options: z.array(z.string()).optional(),
  })
);
