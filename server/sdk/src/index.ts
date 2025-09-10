export interface Logger {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

export interface ServerAPI {
  version: string; // SDK version
  logger: Logger;
}

export interface PluginLifecycle {
  run?(api: ServerAPI): Promise<void> | void;
  stop?(): Promise<void> | void;
}

export type PluginFactory = (api: ServerAPI) => PluginLifecycle | Promise<PluginLifecycle>;

export default {} as any; // Type-only module for plugins to import types during compile
