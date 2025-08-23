import { Request, Response } from "express";
import config from "@/utils/config.js";
import Logger from "@/utils/logger.js";

const logger = new Logger("Setup");

// Create a password to protect the dashboard
export function setupPassword(req: Request, res: Response) {
  const { password } = req.body;
  if (!config.get().password) {
    // If password is not set, create it
    config.set({ password });
    logger.info("Password created successfully");
    res.status(200).json({ message: "Password setup successful" });
  } else {
    res.status(400).json({ message: "Password is already set" });
  }
}

// Check if setup is complete
export function isSetupComplete(req: Request, res: Response) {
  let complete = false;
  if (config.get().password) {
    complete = true;
  }
  res.status(200).json({ result: complete });
}
