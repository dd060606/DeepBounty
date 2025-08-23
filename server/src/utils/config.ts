import fs from "fs";
import path from "path";

const CONFIG_DIR = path.join(process.cwd(), "config");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

// Configuration types
export type Config = {
  port: number;
  password: string;
  [key: string]: any;
};

const DEFAULT_CONFIG: Config = {
  port: 3000,
  password: "",
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
    const parsed = JSON.parse(raw);
    return parsed as Config;
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

// Expose le chemin pour référence/debug
export const configPath = CONFIG_PATH;

const config = {
  get: getConfig,
  set: updateConfig,
  path: configPath,
};

export default config;
