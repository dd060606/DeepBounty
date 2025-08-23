import { z } from "zod";

export const setupPasswordSchema = z.object({
  password: z
    .string()
    .min(12, { message: "Password must be at least 12 characters long" })
    .regex(/[A-Z]/, { message: "Password must include at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must include at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must include at least one number" })
    .regex(/[^A-Za-z0-9]/, { message: "Password must include at least one special character" }),
});
