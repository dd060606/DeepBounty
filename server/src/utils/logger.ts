import fs from "fs";
import path from "path";

const logsDir = path.join(process.cwd(), "logs");
const latestLogPath = path.join(logsDir, "latest.txt");

// Ensure logs directory and latest log file exist
export function initLogger() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }
  if (!fs.existsSync(latestLogPath)) {
    fs.writeFileSync(latestLogPath, `# Log file generated : ${currentDate()}\n`);
  }
}

export default class Logger {
  name: string;
  constructor(name: string) {
    this.name = name;
  }

  info(message: string) {
    console.log(`[${this.name}-INFO] (${currentDate()}) ${message}`);
    fs.appendFileSync(latestLogPath, `[${this.name}-INFO] (${currentDate()}) ${message}\n`);
  }
  error(message: string, error?: any) {
    if (error) {
      if (error.detail) {
        message += `: ${error.detail}`;
      } else if (error.message) {
        message += `: ${error.message}`;
      } else {
        message += `: ${error}`;
      }
    }
    console.error(`[${this.name}-ERROR] (${currentDate()}) ${message}`);
    fs.appendFileSync(latestLogPath, `[${this.name}-ERROR] (${currentDate()}) ${message}\n`);
  }

  warn(message: string) {
    console.error(`[${this.name}-WARN] (${currentDate()}) ${message}`);
    fs.appendFileSync(latestLogPath, `[${this.name}-WARN] (${currentDate()}) ${message}\n`);
  }
}

// Get current date and time with the format: YYYY-MM-DD HH:mm:ss
function currentDate() {
  let date = new Date();
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
