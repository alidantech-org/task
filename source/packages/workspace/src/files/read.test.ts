import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProjectFile } from "#/files/read";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

async function project() {
  root = await mkdtemp(join(tmpdir(), "task-files-"));
  const projectRoot = join(root, "repo");
  await mkdir(join(projectRoot, "src"), { recursive: true });
  await writeFile(join(projectRoot, "src", "app.ts"), "export const a = 1;\n");
  return { root: join(projectRoot, "tasks"), projectRoot };
}

describe("readProjectFile", () => {
  test("reads text files with a language and hash", async () => {
    const context = await project();
    const file = await readProjectFile(context, "src/app.ts");
    expect(file).toMatchObject({ path: "src/app.ts", language: "typescript", binary: false });
    expect(file.content).toContain("export const a");
    expect(file.contentHash).toHaveLength(64);
  });

  test("refuses traversal, protected files, symlinks, directories and binaries", async () => {
    const context = await project();
    await writeFile(join(root, "outside.txt"), "outside");
    await writeFile(join(context.projectRoot, ".env"), "SECRET=1");
    await symlink(join(root, "outside.txt"), join(context.projectRoot, "link.txt"));
    await symlink(root, join(context.projectRoot, "linked-dir"));
    await writeFile(join(context.projectRoot, "bin.dat"), Buffer.from([1, 0, 2]));
    await expect(readProjectFile(context, "../outside.txt")).rejects.toThrow("outside");
    await expect(readProjectFile(context, "/etc/passwd")).rejects.toThrow("project-relative");
    await expect(readProjectFile(context, ".env")).rejects.toThrow("protected");
    await expect(readProjectFile(context, ".git/config")).rejects.toThrow("protected");
    await expect(readProjectFile(context, "link.txt")).rejects.toThrow();
    await expect(readProjectFile(context, "linked-dir/outside.txt")).rejects.toThrow();
    await expect(readProjectFile(context, "src")).rejects.toThrow("not a file");
    await expect(readProjectFile(context, "missing.ts")).rejects.toThrow("No file");
    expect((await readProjectFile(context, "bin.dat")).binary).toBe(true);
  });

  test("rejects files over the size limit", async () => {
    const context = await project();
    await writeFile(join(context.projectRoot, "big.txt"), "x".repeat(1_100_000));
    await expect(readProjectFile(context, "big.txt")).rejects.toThrow("larger");
  });
});
