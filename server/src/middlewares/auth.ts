import { Request, Response, NextFunction } from "express";
import config from "@/utils/config.js";
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

export function requireAuthOrBurpsuiteKey(req: Request, res: Response, next: NextFunction) {
  // Check if user is authenticated via session
  if (req.session?.authenticated) {
    return next();
  }

  // Check for Burp Suite authentication via Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { burpsuiteKey } = config.get();

    if (token === burpsuiteKey) {
      return next();
    }
  }

  return res.status(401).json({ error: "Unauthorized" });
}
