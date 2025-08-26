import { spawn } from "child_process";
import path from "path";

// Build a postgres:// URL from env vars
function buildDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER || "";
  const pass = process.env.DB_PASSWORD || "";
  const db = process.env.DB_NAME || "";

  // If user or pass contain special chars, encode them
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(pass);

  // If no user/pass provided, omit auth part
  const auth = user ? (pass ? `${encUser}:${encPass}@` : `${encUser}@`) : "";
  return `postgres://${auth}${host}:${port}/${db}`;
}

function run() {
  const dbUrl = buildDatabaseUrl();
  if (!dbUrl || /\/$/.test(dbUrl)) {
    console.error(
      "DATABASE_URL invalid. Ensure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (or DATABASE_URL) are defined."
    );
    process.exit(1);
  }

  // Collect additional arguments for the migration command
  const args = process.argv.slice(2);

  // Use local binary from node_modules/.bin for reliability
  const isWin = process.platform === "win32";
  const bin = isWin
    ? path.join(process.cwd(), "node_modules", ".bin", "node-pg-migrate.cmd")
    : path.join(process.cwd(), "node_modules", ".bin", "node-pg-migrate");

  // Pass DATABASE_URL to the child process environment
  const child = spawn(bin, ["-j", "ts", ...args], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
    shell: isWin,
  });

  child.on("error", (err) => {
    console.error("Failed to start node-pg-migrate:", err.message);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

run();
