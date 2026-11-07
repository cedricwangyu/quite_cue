import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const tests = readdirSync(resolve(root, "tests"))
  .filter(filename => filename.endsWith(".test.ts"))
  .sort()
  .map(filename => resolve(root, "tests", filename));

if (tests.length === 0) throw new Error("No test files found.");
const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...tests], {
  cwd: root,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;