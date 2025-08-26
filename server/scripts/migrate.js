import { spawn } from "child_process";
import path from "path";

// Build a database url from env vars
function buildDatabaseUrl() {
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER || "";
  const pass = process.env.DB_PASSWORD || "";
  const db = process.env.DB_NAME || "";

  // If user or pass contain special chars, encode them
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(pass);

  return `postgres://${encUser}:${encPass}@${host}:${port}/${db}`;
}

function run() {
  const dbUrl = buildDatabaseUrl();

  // Collect additional arguments for the migration command
  const args = process.argv.slice(2);

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
