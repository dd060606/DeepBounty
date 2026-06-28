import { Worker } from "node:worker_threads";
import os from "node:os";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Logger from "@/utils/logger.js";

const logger = new Logger("CpuPool");

// Warn when a single CPU task runs longer than this. These tasks run OFF the
// main loop, so a slow one no longer blocks the API — but it tells us which
// inputs are expensive.
const SLOW_TASK_MS = Number(process.env.CPU_SLOW_TASK_MS) || 1000;

// Warn (once per burst) when the backlog grows large. We never drop a task (that
// would be a lost finding); producers apply natural backpressure by awaiting.
const QUEUE_WARN_THRESHOLD = Number(process.env.CPU_QUEUE_WARN) || 500;

interface PendingTask {
  id: number;
  file: string;
  fn: string;
  input: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  enqueuedAt: number;
  startedAt?: number;
  inputBytes: number;
}

interface PoolWorker {
  worker: Worker;
  busy: boolean;
  current: PendingTask | null;
}

/**
 * A small worker-thread pool that runs pure, CPU-bound functions off the main
 * event loop. Used by modules via `api.cpu.run(...)` to keep heavy regex/scan
 * work (which would otherwise block the shared HTTP/WS loop) on spare cores.
 */
export class CpuPool {
  private readonly workers: PoolWorker[] = [];
  private readonly queue: PendingTask[] = [];
  private nextId = 1;
  private queueWarned = false;
  private terminated = false;

  private readonly workerPath: string;
  private readonly execArgv?: string[];

  constructor(size?: number) {
    // Resolve the compiled worker (production) or the .ts source (dev/tsx).
    const jsPath = fileURLToPath(new URL("./worker.js", import.meta.url));
    const tsPath = fileURLToPath(new URL("./worker.ts", import.meta.url));
    const useTs = !existsSync(jsPath) && existsSync(tsPath);
    this.workerPath = useTs ? tsPath : jsPath;
    // In dev the worker is TypeScript; load it through tsx like the parent.
    this.execArgv = useTs ? ["--import", "tsx"] : undefined;

    const cores =
      typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
    let poolSize: number;
    if (size && size > 0) {
      // Explicit override (e.g. tests).
      poolSize = size;
    } else {
      const requested = Number(process.env.CPU_POOL_SIZE) || cores - 1;
      poolSize = Math.max(1, Math.min(requested, 4));
    }

    for (let i = 0; i < poolSize; i++) this.spawnWorker();
    logger.info(`CPU pool started with ${this.workers.length} worker(s)`);
  }

  private spawnWorker(): PoolWorker {
    const worker = new Worker(this.workerPath, { execArgv: this.execArgv });
    const pw: PoolWorker = { worker, busy: false, current: null };

    worker.on("message", (msg: { id: number; ok: boolean; out?: unknown; error?: string }) => {
      this.onResult(pw, msg);
    });
    worker.on("error", (err) => {
      // A worker crashed mid-task: settle the in-flight task (caller falls
      // back to in-process compute — lossless) and replace the worker.
      logger.error("CPU worker crashed", err);
      this.recoverWorker(pw, err);
    });
    worker.on("exit", (code) => {
      if (this.terminated) return;
      if (code !== 0) {
        logger.warn(`CPU worker exited unexpectedly (code=${code}); respawning`);
        this.recoverWorker(pw, new Error(`worker exited with code ${code}`));
      }
    });

    this.workers.push(pw);
    return pw;
  }

  private recoverWorker(pw: PoolWorker, err: unknown): void {
    // Reject the task this worker was running, if any.
    if (pw.current) {
      pw.current.reject(err);
      pw.current = null;
    }
    pw.busy = false;
    // Drop the dead worker and spawn a fresh replacement.
    const idx = this.workers.indexOf(pw);
    if (idx !== -1) this.workers.splice(idx, 1);
    try {
      pw.worker.terminate();
    } catch {
      /* already gone */
    }
    if (!this.terminated) {
      this.spawnWorker();
      this.dispatch();
    }
  }

  private onResult(
    pw: PoolWorker,
    msg: { id: number; ok: boolean; out?: unknown; error?: string }
  ): void {
    const task = pw.current;
    pw.current = null;
    pw.busy = false;

    if (task && task.id === msg.id) {
      const elapsed = Date.now() - (task.startedAt ?? task.enqueuedAt);
      if (elapsed >= SLOW_TASK_MS) {
        logger.warn(
          `Slow CPU task '${task.fn}' took ${elapsed}ms (input ${task.inputBytes} bytes)`
        );
      }
      if (msg.ok) task.resolve(msg.out);
      else task.reject(new Error(msg.error || "CPU task failed"));
    }

    this.dispatch();
  }

  private dispatch(): void {
    if (this.terminated) return;
    for (const pw of this.workers) {
      if (pw.busy) continue;
      const task = this.queue.shift();
      if (!task) break;
      pw.busy = true;
      pw.current = task;
      task.startedAt = Date.now();
      pw.worker.postMessage({
        id: task.id,
        file: task.file,
        fn: task.fn,
        input: task.input,
      });
    }
    if (this.queue.length === 0) this.queueWarned = false;
  }

  /**
   * Run a pure function exported from `file` with `input`, off the main loop.
   * Resolves with the function's serializable return value.
   */
  runCpuTask<O = unknown>(file: string, fn: string, input: unknown): Promise<O> {
    if (this.terminated) {
      return Promise.reject(new Error("CPU pool is terminated"));
    }
    return new Promise<O>((resolve, reject) => {
      const inputBytes =
        typeof input === "string"
          ? input.length
          : input && typeof (input as any).js === "string"
            ? (input as any).js.length
            : 0;
      const task: PendingTask = {
        id: this.nextId++,
        file,
        fn,
        input,
        resolve: resolve as (value: unknown) => void,
        reject,
        enqueuedAt: Date.now(),
        inputBytes,
      };
      this.queue.push(task);
      if (this.queue.length >= QUEUE_WARN_THRESHOLD && !this.queueWarned) {
        this.queueWarned = true;
        logger.warn(
          `CPU task queue depth high (${this.queue.length}); producers are outpacing ${this.workers.length} worker(s).`
        );
      }
      this.dispatch();
    });
  }

  async terminate(): Promise<void> {
    this.terminated = true;
    await Promise.allSettled(this.workers.map((pw) => pw.worker.terminate()));
    this.workers.length = 0;
  }
}

let poolInstance: CpuPool | null = null;

/** Get the shared CPU pool, constructing it on first use. */
export function getCpuPool(): CpuPool {
  if (!poolInstance) poolInstance = new CpuPool();
  return poolInstance;
}

/** Terminate the shared CPU pool (called on server shutdown). */
export async function shutdownCpuPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.terminate();
    poolInstance = null;
  }
}
