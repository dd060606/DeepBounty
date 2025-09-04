import { Request, Response } from "express";
import config from "@/utils/config.js";
import Logger from "@/utils/logger.js";
import bcrypt from "bcrypt";

const logger = new Logger("Setup");

// POST /setup/password - create a password to protect the dashboard
export function setupPassword(req: Request, res: Response) {
  const { password } = req.body;
  if (!config.get().password) {
    // If password is not set, create it
    bcrypt.hash(password, 12, (err, hash) => {
      if (err) {
        logger.error("Error hashing password");
        return res.status(500).json({ message: "Internal server error" });
      }
      config.set({ password: hash });
      req.session.authenticated = true;
      logger.info("Password created successfully");
      res.status(200).json({ message: "Password setup successful" });
    });
  } else {
    res.status(400).json({ message: "Password is already set" });
  }
}
