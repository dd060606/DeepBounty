import fs from "fs";
// Returns a list of installed tools (toolname@version)
export function getInstalledTools(): string[] {
  const installedTools: string[] = [];
  fs.readdirSync("/tools").forEach((file) => {
    // If it's a directory with the name format toolname@version, include it
    const toolPath = `/tools/${file}`;
    if (fs.statSync(toolPath).isDirectory() && file.includes("@")) {
      installedTools.push(file);
    }
  });
  return installedTools;
}
