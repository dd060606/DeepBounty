export interface Logger {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

interface Setting {
  name: string;
  type: "checkbox" | "text" | "select" | "info";
  default: any;
  label: string;
  value: any;
}

export interface ConfigAPI {
  get<T = any>(key: string, defaultValue?: T): Promise<T>;
  set<T = any>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getAll(): Promise<Record<string, any>>;
  getSetting(name: string): Promise<Setting>;
  setSetting(name: string, value: any): Promise<void>;
  getAllSettings(): Promise<Setting[]>;
}

export interface ServerAPI {
  version: string; // SDK version
  logger: Logger;
  config: ConfigAPI;
}

export interface PluginLifecycle {
  run?(api: ServerAPI): Promise<void> | void;
  stop?(): Promise<void> | void;
}

export type PluginFactory = (api: ServerAPI) => PluginLifecycle | Promise<PluginLifecycle>;

export default {} as any; // Type-only module for plugins to import types during compile
