import { Request, Response } from "express";
import bcrypt from "bcrypt";
import config from "@/utils/config.js";
import Logger from "@/utils/logger.js";

const logger = new Logger("Auth");

export async function login(req: Request, res: Response) {
  const { password } = req.body;

  const hash = config.get().password;
  if (!hash) return res.status(400).json({ error: "Setup not completed" });

  try {
    const match = await bcrypt.compare(password, hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid password" });
    }

    req.session.authenticated = true;
    logger.info(req.ip + " logged in successfully");
    return res.sendStatus(200);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export function logout(req: Request, res: Response) {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.sendStatus(200);
  });
}

export function authInfo(req: Request, res: Response) {
  let status = "";
  if (config.get().password) {
    // If setup is complete, check authentication status
    status = req.session.authenticated ? "authenticated" : "unauthenticated";
  } else {
    status = "setup-required";
  }
  res.status(200).json({ status });
}
