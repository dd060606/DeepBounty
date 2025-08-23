import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

type Segment = "body" | "query" | "params";

function makeValidator(segment: Segment) {
  return (schema: z.ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
    try {
      req[segment] = schema.parse((req as any)[segment]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: "ValidationError",
          issues: err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        });
      }
      next(err);
    }
  };
}

// Validate request data
export const validateBody = makeValidator("body");
export const validateParams = makeValidator("params");
export const validateQuery = makeValidator("query");
