import { ScopedDirectory, ModuleFiles } from "./moduleFiles.js";
import fs from "fs";
import path from "path";
import { MODULES_DIR } from "../../utils/constants.js";

async function runTests() {
  const moduleId = "test-module";
  const moduleFiles = new ModuleFiles(moduleId);
  const filesBasePath = path.join(MODULES_DIR, moduleId, "files");

  console.log(`Files base path: ${filesBasePath}`);

  // Test ModuleFiles.getDirectory
  console.log("\nTesting ModuleFiles.getDirectory...");
  const validDir = "valid-dir";
  try {
    const scoped = moduleFiles.getDirectory(validDir);
    console.log("✅ getDirectory(valid-dir) - Success");
  } catch (e) {
    console.error(`❌ getDirectory(valid-dir) - Failed: ${e.message}`);
  }

  const traversalDir = "../files_secret";
  try {
    moduleFiles.getDirectory(traversalDir);
    console.error("❌ getDirectory(../files_secret) - SHOULD HAVE FAILED");
  } catch (e) {
    console.log(`✅ getDirectory(../files_secret) - Failed as expected: ${e.message}`);
  }

  // Test ScopedDirectory.validatePath (via public methods)
  console.log("\nTesting ScopedDirectory validation...");
  const scopedDir = moduleFiles.getDirectory("test-dir");

  try {
    scopedDir.writeFileText("test.txt", "hello");
    console.log("✅ writeFileText(test.txt) - Success");
  } catch (e) {
    console.error(`❌ writeFileText(test.txt) - Failed: ${e.message}`);
  }

  try {
    scopedDir.readFileText("../test-dir_secret/secret.txt");
    console.error("❌ readFileText(../test-dir_secret/secret.txt) - SHOULD HAVE FAILED");
  } catch (e) {
    console.log(`✅ readFileText(../test-dir_secret/secret.txt) - Failed as expected: ${e.message}`);
  }

  try {
    scopedDir.readFileText("../../secret.txt");
    console.error("❌ readFileText(../../secret.txt) - SHOULD HAVE FAILED");
  } catch (e) {
    console.log(`✅ readFileText(../../secret.txt) - Failed as expected: ${e.message}`);
  }

  // Test directory with same prefix
  const prefixDir = "../test-dir-other";
  try {
    scopedDir.getSubdirectory(prefixDir);
    console.error(`❌ getSubdirectory(${prefixDir}) - SHOULD HAVE FAILED`);
  } catch (e) {
    console.log(`✅ getSubdirectory(${prefixDir}) - Failed as expected: ${e.message}`);
  }

  console.log("\nAll security tests completed!");
}

runTests().catch(console.error);
