import fs from "fs";
import path from "path";

const logsDir = path.join(process.cwd(), "logs");
const LOG_RETENTION_DAYS = 30;

// We store the path for the current server session here
let currentLogFilePath: string;
let logStream: fs.WriteStream | null = null;

export function initLogger() {
  // Ensure directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }

  // Clean up old logs
  cleanupOldLogs();

  // Generate a new file name for this session
  const filename = `server-${getSafeFileNameDate()}.txt`;
  currentLogFilePath = path.join(logsDir, filename);

  // Create the file/stream immediately (non-blocking writes during runtime)
  fs.writeFileSync(currentLogFilePath, `# Log session started : ${currentDate()}\n`);
  logStream = fs.createWriteStream(currentLogFilePath, { flags: "a" });
  logStream.on("error", (error) => {
    console.error(`[Logger] Stream error:`, error);
  });
}

function cleanupOldLogs() {
  try {
    const files = fs.readdirSync(logsDir);
    const now = Date.now();
    const maxAge = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000; // Days to ms

    files.forEach((file) => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);

      // Check if file is older than maxAge
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.error(`[Logger] Failed to cleanup old logs:`, error);
  }
}

export default class Logger {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  private write(level: string, message: string) {
    const timestamp = currentDate();
    const formattedMessage = `[${this.name}-${level}] (${timestamp}) ${message}`;

    // Console output
    if (level === "ERROR" || level === "WARN") {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // File output (non-blocking)
    if (logStream) {
      logStream.write(formattedMessage + "\n");
      return;
    }

    // Fallback when stream is not initialized yet
    if (currentLogFilePath) {
      fs.appendFile(currentLogFilePath, formattedMessage + "\n", () => {});
    }
  }

  info(message: string) {
    this.write("INFO", message);
  }

  error(message: string, error?: any) {
    let output = message;
    if (error) {
      if (error.detail) {
        output += `: ${error.detail}`;
      } else if (error.message) {
        output += `: ${error.message}`;
      } else {
        output += `: ${JSON.stringify(error)}`;
      }
    }
    this.write("ERROR", output);
  }

  warn(message: string) {
    this.write("WARN", message);
  }
}

// Formatted for log content (Readable: YYYY-MM-DD HH:mm:ss)
function currentDate() {
  const date = new Date();
  return (
    date.getFullYear() +
    "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date.getDate()).slice(-2) +
    " " +
    ("0" + date.getHours()).slice(-2) +
    ":" +
    ("0" + date.getMinutes()).slice(-2) +
    ":" +
    ("0" + date.getSeconds()).slice(-2)
  );
}

// Formatted for Filename (Safe: YYYY-MM-DD_HH-mm-ss)
function getSafeFileNameDate() {
  const date = new Date();
  return (
    date.getFullYear() +
    "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date.getDate()).slice(-2) +
    "_" +
    ("0" + date.getHours()).slice(-2) +
    "-" +
    ("0" + date.getMinutes()).slice(-2) +
    "-" +
    ("0" + date.getSeconds()).slice(-2)
  );
}
