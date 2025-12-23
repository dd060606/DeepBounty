import fs from "fs";
import path from "path";
import Logger from "@/utils/logger.js";
import { MODULES_DIR } from "@/utils/constants.js";

const logger = new Logger("ModuleFiles");

/**
 * ScopedDirectory provides isolated file system access within a specific directory
 */
export class ScopedDirectory {
  private basePath: string;
  private moduleId: string;

  constructor(moduleId: string, directoryPath: string) {
    this.moduleId = moduleId;
    this.basePath = directoryPath;
  }

  /**
   * Validate a relative path
   */
  private validatePath(relativePath: string): string {
    // Reject absolute paths
    if (path.isAbsolute(relativePath)) {
      throw new Error(`Absolute paths are not allowed: ${relativePath}`);
    }

    // Normalize the path to resolve any .. or . segments
    const normalized = path.normalize(relativePath);

    // Build the full path
    const fullPath = path.join(this.basePath, normalized);

    // Ensure the resolved path is still within the base directory
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error(`Path escapes base directory: ${relativePath}`);
    }

    return fullPath;
  }

  /**
   * Write binary data to a file (creates parent directories if needed)
   */
  writeFile(relativePath: string, data: Buffer | Uint8Array): void {
    try {
      const fullPath = this.validatePath(relativePath);
      const dir = path.dirname(fullPath);

      // Ensure parent directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, data);
    } catch (err) {
      logger.error(`Failed to write file in module "${this.moduleId}":`, err);
      throw err;
    }
  }

  /**
   * Write text to a file (creates parent directories if needed)
   */
  writeFileText(relativePath: string, text: string, encoding: BufferEncoding = "utf8"): void {
    try {
      const fullPath = this.validatePath(relativePath);
      const dir = path.dirname(fullPath);

      // Ensure parent directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, text, encoding);
    } catch (err) {
      logger.error(`Failed to write text file in module "${this.moduleId}":`, err);
      throw err;
    }
  }

  /**
   * Read binary data from a file
   */
  readFile(relativePath: string): Buffer {
    try {
      const fullPath = this.validatePath(relativePath);
      return fs.readFileSync(fullPath);
    } catch (err) {
      logger.error(`Failed to read file in module "${this.moduleId}":`, err);
      throw err;
    }
  }

  /**
   * Read text from a file
   */
  readFileText(relativePath: string, encoding: BufferEncoding = "utf8"): string {
    try {
      const fullPath = this.validatePath(relativePath);
      return fs.readFileSync(fullPath, encoding);
    } catch (err) {
      logger.error(`Failed to read text file in module "${this.moduleId}":`, err);
      throw err;
    }
  }

  /**
   * Delete a file
   */
  deleteFile(relativePath: string): void {
    try {
      const fullPath = this.validatePath(relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      logger.error(`Failed to delete file in module "${this.moduleId}":`, err);
      throw err;
    }
  }

  /**
   * Get a scoped subdirectory (creates it if it doesn't exist)
   */
  getSubdirectory(relativePath: string): ScopedDirectory {
    try {
      const fullPath = this.validatePath(relativePath);

      // Ensure the directory exists
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }

      return new ScopedDirectory(this.moduleId, fullPath);
    } catch (err) {
      logger.error(`Failed to get subdirectory in module "${this.moduleId}":`, err);
      throw err;
    }
  }

  /**
   * List all files in a directory (optionally in a subdirectory)
   * Returns an array of relative paths
   */
  listFiles(subdirPath?: string): string[] {
    try {
      const fullPath = subdirPath ? this.validatePath(subdirPath) : this.basePath;

      if (!fs.existsSync(fullPath)) {
        return [];
      }

      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => {
          if (subdirPath) {
            return path.join(subdirPath, entry.name);
          }
          return entry.name;
        });
    } catch (err) {
      logger.error(`Failed to list files in module "${this.moduleId}":`, err);
      throw err;
    }
  }

  /**
   * Check if a file exists
   */
  fileExists(relativePath: string): boolean {
    try {
      const fullPath = this.validatePath(relativePath);
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
    } catch (err) {
      return false;
    }
  }
}

/**
 * ModuleFiles provides file system access for a module
 * Each module can create isolated directories within their module folder
 */
export class ModuleFiles {
  private moduleId: string;
  private filesBasePath: string;

  constructor(moduleId: string) {
    this.moduleId = moduleId;
    // Files are stored in {MODULES_DIR}/{moduleId}/files/
    this.filesBasePath = path.join(MODULES_DIR, moduleId, "files");
  }

  /**
   * Get or create a directory by path (supports nested paths like "cache/images")
   * Returns a ScopedDirectory object
   */
  getDirectory(directoryPath: string): ScopedDirectory {
    try {
      // Validate the directory path
      if (path.isAbsolute(directoryPath)) {
        throw new Error(`Absolute paths are not allowed: ${directoryPath}`);
      }

      const normalized = path.normalize(directoryPath);

      // Build full directory path
      const fullPath = path.join(this.filesBasePath, normalized);

      // Ensure the path doesn't escape the files base directory
      if (!fullPath.startsWith(this.filesBasePath)) {
        throw new Error(`Path escapes module directory: ${directoryPath}`);
      }

      // Create the directory if it doesn't exist
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }

      return new ScopedDirectory(this.moduleId, fullPath);
    } catch (err) {
      logger.error(`Failed to get directory for module "${this.moduleId}":`, err);
      throw err;
    }
  }
}

/*
 * Clear all module data by deleting their custom directories and files
 */
export function clearAllModuleFiles(): void {
  try {
    if (!fs.existsSync(MODULES_DIR)) {
      return;
    }
    const moduleDirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true });
    for (const dirent of moduleDirs) {
      if (dirent.isDirectory()) {
        // Only remove the "files" subdirectory
        const filesPath = path.join(MODULES_DIR, dirent.name, "files");
        if (fs.existsSync(filesPath)) {
          fs.rmSync(filesPath, { recursive: true, force: true });
        }
      }
    }
  } catch (err) {
    logger.error("Failed to clear all module files:", err);
    throw err;
  }
}
