import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Keep tests away from the real tracking and trash directories.
const created: string[] = [];
for (const name of ["TASK_DATA_DIR", "TASK_TRASH_DIR"]) {
  if (process.env[name]) continue;
  const directory = mkdtempSync(join(tmpdir(), `task-test-${name.toLowerCase()}-`));
  process.env[name] = directory;
  created.push(directory);
}
process.on("exit", () => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true });
});
