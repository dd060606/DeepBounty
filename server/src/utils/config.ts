import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { NotificationService } from "@deepbounty/sdk/types";

const CONFIG_DIR = path.join(process.cwd(), "config");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

// Configuration types
export type Config = {
  password: string;
  enableSwaggerUi: boolean;
  workerKey: string;
  burpsuiteKey: string;
  externalUrl: string;
  notificationServices: NotificationService[];
  [key: string]: any;
};

const DEFAULT_CONFIG: Config = {
  password: "",
  enableSwaggerUi: false,
  workerKey: generateRandomKey(),
  burpsuiteKey: generateRandomKey(),
  externalUrl: process.env.EXTERNAL_URL || "",
  notificationServices: [],
};

let cachedConfig: Config | null = null;

// Ensure config directory and file exist
function initConfig(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
  }
}

function readConfigFromDisk(): Config {
  initConfig();
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Config;

    // Backfill any missing default keys without overwriting user values
    const merged: Config = { ...DEFAULT_CONFIG, ...parsed };

    // Persist only if new keys were added (i.e., defaults introduced later)
    const needsWrite = Object.keys(DEFAULT_CONFIG).some((k) => !(k in (parsed as object)));
    if (needsWrite) {
      writeConfigToDisk(merged);
    }

    return merged;
  } catch (err) {
    // If JSON is invalid, create a backup and reset
    const backup = path.join(CONFIG_DIR, `config.bak-${Date.now()}.json`);
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        fs.copyFileSync(CONFIG_PATH, backup);
      }
    } catch {
      // ignore backup failures
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfigToDisk(config: Config): void {
  // Atomic write
  const tmpPath = CONFIG_PATH + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf-8");
  fs.renameSync(tmpPath, CONFIG_PATH);
}

export function generateRandomKey(): string {
  return randomBytes(32).toString("hex");
}

export function loadConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = readConfigFromDisk();
  }
  return cachedConfig;
}

export function getConfig(): Config {
  return loadConfig();
}

// Update in-memory config and persist
export function updateConfig(patch: Partial<Config>): Config {
  const current = loadConfig();
  cachedConfig = { ...current, ...patch };
  writeConfigToDisk(cachedConfig);
  return cachedConfig;
}

export const configPath = CONFIG_PATH;

const config = {
  get: getConfig,
  set: updateConfig,
  path: configPath,
};

export default config;
