import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDocumentChecklist } from "#/operations/checklist";
import { createTask, createTaskGroup, setDocumentChecklist } from "#/operations/mutate";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

async function task() {
  root = await mkdtemp(join(tmpdir(), "task-checklist-"));
  const context = {
    root: join(root, "tasks"),
    projectRoot: root,
    config: { workspace: "tasks", quality: { mode: "off" as const } },
  };
  await mkdir(context.root, { recursive: true });
  const group = await createTaskGroup(context, "Work");
  const created = await createTask(context, {
    title: "Checklist",
    group: group.id,
    body: "# Checklist\n\n## Design\n- [ ] one\n- [ ] two\n\n## Build\n- [ ] three\n",
  });
  return { context, id: created.metadata.id };
}

describe("document checklist operations", () => {
  test("checks a section, then everything, and keeps the rest of the file intact", async () => {
    const { context, id } = await task();
    const section = await setDocumentChecklist(context, id, { section: "Design" }, true);
    expect(section.changed).toBe(2);
    const afterSection = await readDocumentChecklist(context, id);
    expect(afterSection.checklist.completed).toBe(2);
    const all = await setDocumentChecklist(context, id, { all: true }, true);
    expect(all.changed).toBe(1);
    expect((await readDocumentChecklist(context, id)).checklist.completed).toBe(3);
    const none = await setDocumentChecklist(context, id, { all: true }, true);
    expect(none.changed).toBe(0);
  });

  test("rejects stale hashes and unknown selections", async () => {
    const { context, id } = await task();
    const before = (await readDocumentChecklist(context, id)).document.contentHash;
    await setDocumentChecklist(context, id, { items: [0] }, true);
    await expect(setDocumentChecklist(context, id, { items: [1] }, true, before)).rejects.toThrow();
    await expect(setDocumentChecklist(context, id, { section: "Missing" }, true)).rejects.toThrow(
      "No checklist section",
    );
    await expect(setDocumentChecklist(context, id, { items: [42] }, true)).rejects.toThrow(
      "No checklist item 43",
    );
  });
});
