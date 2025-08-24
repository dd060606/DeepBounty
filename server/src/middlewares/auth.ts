import { Request, Response, NextFunction } from "express";
import "express-session";

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
  }
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.authenticated) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
