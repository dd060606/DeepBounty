import { parentPort } from "node:worker_threads";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

/**
 * CPU worker entry.
 *
 * Runs pure, CPU-bound functions exported from a module's side-effect-free
 * `cpu.js` file, OFF the server's main event loop. It must never touch the DB,
 * files, events or the SDK — only `input -> serializable output`.
 *
 * Protocol (parent -> worker): { id, file, fn, input }
 * Reply  (worker -> parent):   { id, ok: true, out } | { id, ok: false, error }
 */

const require = createRequire(import.meta.url);

// Cache required cpu.js modules per absolute path so each file is loaded once
// per worker, not once per task.
const moduleCache = new Map<string, any>();

function loadModule(file: string): any {
  let mod = moduleCache.get(file);
  if (!mod) {
    mod = require(file);
    // esbuild CJS bundles expose named exports directly; some wrap in default.
    moduleCache.set(file, mod);
  }
  return mod;
}

interface TaskMessage {
  id: number;
  file: string;
  fn: string;
  input: unknown;
}

if (!parentPort) {
  throw new Error("cpu/worker must be run as a worker thread");
}

parentPort.on("message", async (msg: TaskMessage) => {
  const { id, file, fn, input } = msg;
  try {
    const mod = loadModule(file);
    const target = mod?.[fn] ?? mod?.default?.[fn];
    if (typeof target !== "function") {
      throw new Error(`Export '${fn}' not found in ${file}`);
    }
    // Support both sync and async pure functions.
    const startedAt = performance.now();
    const out = await target(input);
    const ms = performance.now() - startedAt;
    parentPort!.postMessage({ id, ok: true, out, ms });
  } catch (err: any) {
    parentPort!.postMessage({
      id,
      ok: false,
      error: err?.message ? String(err.message) : String(err),
    });
  }
});
