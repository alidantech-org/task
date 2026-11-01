import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFrontmatter, serializeMarkdown } from "#/indexing/metadata";
import type { WorkspaceContext } from "#/indexing/types";
import { buildActivity } from "#/operations/activity";
import {
  addFileAttachment,
  addLinkAttachment,
  readAttachment,
  removeAttachment,
  sanitizeFileName,
} from "#/operations/attachments";
import { bulkUpdateTasks } from "#/operations/bulk";
import { addTaskComment, deleteTaskComment, listTaskComments } from "#/operations/comment-ops";
import { moveTask } from "#/operations/move";
import { createTask, createTaskGroup, updateTask } from "#/operations/mutate";
import { effectiveOrder, sortTasks } from "#/operations/order";
import { findDocument, listTasks, readWorkspaceIndex } from "#/operations/query";
import { reorderTask } from "#/operations/reorder";
import { createTaskFromTemplate, createTemplate, listTemplates } from "#/operations/templates";
import { validateWorkspace } from "#/operations/validate";

let root = "";
let context: WorkspaceContext;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "task-features-"));
  context = {
    root: join(root, "tasks"),
    projectRoot: root,
    config: { workspace: "tasks", quality: { mode: "off" } },
  };
  await mkdir(context.root, { recursive: true });
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function tasks(group: { id: string }, titles: string[]) {
  const created = [];
  for (const title of titles) created.push(await createTask(context, { title, group: group.id }));
  return created;
}
async function orderOf(group: { path: string }) {
  const index = await readWorkspaceIndex(context);
  return sortTasks(listTasks(index).filter((task) => task.path.startsWith(`${group.path}/`))).map(
    (task) => task.metadata.name,
  );
}

describe("ordering", () => {
  test("new tasks get ascending ranks and reorder places a task between neighbours", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a, b, c] = await tasks(group, ["A", "B", "C"]);
    expect(await orderOf(group)).toEqual(["A", "B", "C"]);
    expect(effectiveOrder(c as never)).toBeGreaterThan(effectiveOrder(b as never));
    await reorderTask(context, c?.metadata.id ?? "", { before: a?.metadata.id });
    expect(await orderOf(group)).toEqual(["C", "A", "B"]);
    await reorderTask(context, c?.metadata.id ?? "", { after: a?.metadata.id });
    expect(await orderOf(group)).toEqual(["A", "C", "B"]);
    await reorderTask(context, a?.metadata.id ?? "", { after: b?.metadata.id });
    expect(await orderOf(group)).toEqual(["C", "B", "A"]);
  });

  test("renumbers a group when there is no room between neighbours", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a, b, c] = await tasks(group, ["A", "B", "C"]);
    await updateTask(context, a?.metadata.id ?? "", { order: 1 });
    await updateTask(context, b?.metadata.id ?? "", { order: 1 + 1e-9 });
    await reorderTask(context, c?.metadata.id ?? "", { after: a?.metadata.id });
    expect(await orderOf(group)).toEqual(["A", "C", "B"]);
    const index = await readWorkspaceIndex(context);
    const ranks = ["A", "C", "B"].map(
      (name) => listTasks(index).find((task) => task.metadata.name === name)?.metadata.order,
    );
    expect(ranks).toEqual([1024, 2048, 3072]);
  });

  test("rejects unknown anchors and ambiguous targets", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a, b] = await tasks(group, ["A", "B"]);
    await expect(
      reorderTask(context, a?.metadata.id ?? "", { before: "TSK-NOPE" }),
    ).rejects.toThrow("not another task");
    await expect(
      reorderTask(context, a?.metadata.id ?? "", { before: b?.metadata.id, order: 3 }),
    ).rejects.toThrow("exactly one");
  });
});

describe("hierarchy, relations and fields", () => {
  test("sets parent, links, watchers, estimate and recurrence and clears them", async () => {
    const group = await createTaskGroup(context, "Work");
    const [parent, child, other] = await tasks(group, ["Parent", "Child", "Other"]);
    const updated = await updateTask(context, child?.metadata.id ?? "", {
      parent: parent?.metadata.id,
      estimate: 5,
      links: [{ type: "blocks", task: other?.metadata.id ?? "" }],
      watchers: ["peter"],
      recurrence: { every: "week", interval: 1 },
    });
    expect(updated.task.metadata).toMatchObject({
      parent: parent?.metadata.id,
      estimate: 5,
      watchers: ["peter"],
    });
    const cleared = await updateTask(context, child?.metadata.id ?? "", {
      parent: null,
      estimate: null,
      links: [],
      watchers: [],
      recurrence: null,
    });
    expect(cleared.task.metadata.parent).toBeUndefined();
    expect(cleared.task.metadata.links).toBeUndefined();
    expect(cleared.task.metadata.recurrence).toBeUndefined();
  });

  test("refuses parents that do not exist, point at themselves or form cycles", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a, b] = await tasks(group, ["A", "B"]);
    await expect(updateTask(context, a?.metadata.id ?? "", { parent: "TSK-NOPE" })).rejects.toThrow(
      "Unknown parent",
    );
    await expect(
      updateTask(context, a?.metadata.id ?? "", { parent: a?.metadata.id }),
    ).rejects.toThrow("own parent");
    await updateTask(context, b?.metadata.id ?? "", { parent: a?.metadata.id });
    await expect(
      updateTask(context, a?.metadata.id ?? "", { parent: b?.metadata.id }),
    ).rejects.toThrow("cycles");
    await expect(
      updateTask(context, a?.metadata.id ?? "", { links: [{ type: "relates", task: "TSK-NOPE" }] }),
    ).rejects.toThrow("Unknown linked");
  });

  test("validate reports dangling references and missing attachment files", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a] = await tasks(group, ["A"]);
    const doc = findDocument(await readWorkspaceIndex(context), a?.metadata.id ?? "");
    const path = join(context.root, doc.path);
    const parsed = parseFrontmatter(await readFile(path, "utf8"));
    await writeFile(
      path,
      serializeMarkdown(
        {
          ...parsed.values,
          parent: "TSK-GONE",
          links: [{ type: "blocks", task: "TSK-GONE" }],
          attachments: [
            {
              kind: "file",
              name: "x.txt",
              path: `attachments/${doc.metadata.id}/x.txt`,
              size: 1,
              added_at: "2026-11-01T00:00:00.000Z",
            },
          ],
        },
        parsed.body,
      ),
    );
    const messages = (await validateWorkspace(context)).map((diagnostic) => diagnostic.message);
    expect(messages.some((message) => message.includes("Unknown parent task ID"))).toBe(true);
    expect(messages.some((message) => message.includes("Unknown linked task ID"))).toBe(true);
    expect(messages.some((message) => message.includes("Attachment file is missing"))).toBe(true);
  });
});

describe("moving, bulk and templates", () => {
  test("moves a task to another group, placing it last", async () => {
    const one = await createTaskGroup(context, "One");
    const two = await createTaskGroup(context, "Two");
    const [a] = await tasks(one, ["A"]);
    await tasks(two, ["X", "Y"]);
    const moved = await moveTask(context, a?.metadata.id ?? "", two.id);
    expect(moved.path.startsWith(`${two.path}/`)).toBe(true);
    expect(moved.metadata.id).toBe(a?.metadata.id);
    expect(await orderOf(two)).toEqual(["X", "Y", "A"]);
    await expect(moveTask(context, a?.metadata.id ?? "", "GRP-NOPE")).rejects.toThrow();
  });

  test("bulk updates report each task and keep going after a failure", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a, b] = await tasks(group, ["A", "B"]);
    const results = await bulkUpdateTasks(
      context,
      [a?.metadata.id ?? "", "TSK-NOPE", b?.metadata.id ?? ""],
      {
        priority: "high",
        assignee: "ann",
      },
    );
    expect(results.map((result) => result.ok)).toEqual([true, false, true]);
    const index = await readWorkspaceIndex(context);
    expect(findDocument(index, b?.metadata.id ?? "").metadata).toMatchObject({
      priority: "high",
      assignee: "ann",
    });
    await expect(bulkUpdateTasks(context, [], {})).rejects.toThrow("at least one");
  });

  test("creates tasks from templates with their defaults", async () => {
    const group = await createTaskGroup(context, "Work");
    const template = await createTemplate(context, {
      name: "Bug report",
      body: "# Bug\n\n## Goal\nFix it.\n\n## Acceptance checklist\n- [ ] Reproduce\n",
      defaults: { priority: "high", tags: ["bug"], estimate: 2 },
    });
    expect((await listTemplates(context)).map((item) => item.name)).toEqual(["Bug report"]);
    const created = await createTaskFromTemplate(context, template.id, {
      title: "Login fails",
      group: group.id,
    });
    expect(created.metadata).toMatchObject({
      name: "Login fails",
      priority: "high",
      tags: ["bug"],
      estimate: 2,
    });
    const body = await readFile(join(context.root, created.path), "utf8");
    expect(body).toContain("# Login fails");
    expect(body).toContain("- [ ] Reproduce");
    await expect(
      createTaskFromTemplate(context, created.metadata.id, { title: "x", group: group.id }),
    ).rejects.toThrow("not a task template");
  });
});

describe("recurrence", () => {
  test("completing a recurring task creates the next occurrence with a fresh checklist", async () => {
    const group = await createTaskGroup(context, "Work");
    const created = await createTask(context, {
      title: "Weekly report",
      group: group.id,
      dueAt: "2026-11-02",
      recurrence: { every: "week", interval: 1 },
      body: "# Weekly\n\n## Goal\nReport.\n\n## Acceptance checklist\n- [x] Draft\n\n## Comments\n\n### 2026-11-01T10:00:00.000Z · A\n\nold\n",
    });
    await updateTask(context, created.metadata.id, { status: "completed" });
    const index = await readWorkspaceIndex(context);
    const all = listTasks(index).filter((task) => task.metadata.name === "Weekly report");
    expect(all).toHaveLength(2);
    const next = all.find((task) => task.metadata.id !== created.metadata.id);
    expect(next?.metadata).toMatchObject({ status: "planned", due_at: "2026-11-09" });
    expect(next?.metadata.extra?.recurred_from).toBe(created.metadata.id);
    const text = await readFile(join(context.root, next?.path ?? ""), "utf8");
    expect(text).toContain("- [ ] Draft");
    expect(text).not.toContain("old");
  });

  test("stops after the until date", async () => {
    const group = await createTaskGroup(context, "Work");
    const created = await createTask(context, {
      title: "Ends",
      group: group.id,
      dueAt: "2026-11-02",
      recurrence: { every: "week", interval: 1, until: "2026-11-05" },
    });
    await updateTask(context, created.metadata.id, { status: "completed" });
    expect(
      listTasks(await readWorkspaceIndex(context)).filter((task) => task.metadata.name === "Ends"),
    ).toHaveLength(1);
  });
});

describe("comments and activity", () => {
  test("adds, lists and deletes comments with authors", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a] = await tasks(group, ["A"]);
    const id = a?.metadata.id ?? "";
    await addTaskComment(context, id, "First comment @ann", "Peter");
    await addTaskComment(context, id, "Second", "Ann");
    const comments = await listTaskComments(context, id);
    expect(comments.map((comment) => [comment.author, comment.text])).toEqual([
      ["Peter", "First comment @ann"],
      ["Ann", "Second"],
    ]);
    await deleteTaskComment(context, id, 0);
    expect((await listTaskComments(context, id)).map((comment) => comment.text)).toEqual([
      "Second",
    ]);
    await expect(addTaskComment(context, id, "  ")).rejects.toThrow("empty");
    await expect(deleteTaskComment(context, id, 9)).rejects.toThrow("No comment");
  });

  test("uses TASK_AUTHOR when no author is given", async () => {
    const previous = process.env.TASK_AUTHOR;
    process.env.TASK_AUTHOR = "Env Author";
    try {
      const group = await createTaskGroup(context, "Work");
      const [a] = await tasks(group, ["A"]);
      await addTaskComment(context, a?.metadata.id ?? "", "hello");
      expect((await listTaskComments(context, a?.metadata.id ?? ""))[0]?.author).toBe("Env Author");
    } finally {
      if (previous === undefined) delete process.env.TASK_AUTHOR;
      else process.env.TASK_AUTHOR = previous;
    }
  });

  test("builds a newest-first timeline", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a] = await tasks(group, ["A"]);
    await updateTask(context, a?.metadata.id ?? "", { status: "in-progress" });
    await addTaskComment(context, a?.metadata.id ?? "", "note", "Peter");
    const doc = findDocument(await readWorkspaceIndex(context), a?.metadata.id ?? "");
    const timeline = buildActivity(
      doc.metadata,
      await listTaskComments(context, a?.metadata.id ?? ""),
    );
    const kinds = timeline.map((entry) => entry.kind);
    expect(kinds).toContain("created");
    expect(kinds).toContain("status");
    expect(kinds).toContain("comment");
    expect(Date.parse(timeline[0]?.at ?? "")).toBeGreaterThanOrEqual(
      Date.parse(timeline.at(-1)?.at ?? ""),
    );
  });
});

describe("attachments", () => {
  test("stores a small file safely, lists it, downloads it and removes it", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a] = await tasks(group, ["A"]);
    const id = a?.metadata.id ?? "";
    const updated = await addFileAttachment(
      context,
      id,
      { name: "../../notes.txt", data: new TextEncoder().encode("hello") },
      "Peter",
    );
    const attachment = updated.metadata.attachments?.[0];
    expect(attachment).toMatchObject({
      kind: "file",
      name: "notes.txt",
      size: 5,
      added_by: "Peter",
    });
    expect(attachment?.path).toBe(`attachments/${id}/notes.txt`);
    expect((await stat(join(context.root, attachment?.path ?? ""))).mode & 0o777).toBe(0o600);
    const twin = await addFileAttachment(context, id, {
      name: "notes.txt",
      data: new Uint8Array([1]),
    });
    expect(twin.metadata.attachments?.map((item) => item.name)).toEqual([
      "notes.txt",
      "notes-2.txt",
    ]);
    expect(new TextDecoder().decode((await readAttachment(context, id, "notes.txt")).data)).toBe(
      "hello",
    );
    await removeAttachment(context, id, "notes.txt");
    await expect(readAttachment(context, id, "notes.txt")).rejects.toThrow("No attachment");
    expect(await Bun.file(join(context.root, "attachments", id, "notes.txt")).exists()).toBe(false);
  });

  test("refuses oversize files, protected names and symlinked folders; accepts links", async () => {
    const group = await createTaskGroup(context, "Work");
    const [a] = await tasks(group, ["A"]);
    const id = a?.metadata.id ?? "";
    await expect(
      addFileAttachment(context, id, { name: "big.bin", data: new Uint8Array(1_000_001) }),
    ).rejects.toThrow("Attach a link");
    await expect(
      addFileAttachment(context, id, { name: "id_rsa", data: new Uint8Array(1) }),
    ).rejects.toThrow("protected");
    await expect(
      addFileAttachment(context, id, { name: "...", data: new Uint8Array(1) }),
    ).rejects.toThrow("file name");
    const outside = join(root, "outside");
    await mkdir(outside);
    await mkdir(join(context.root, "attachments"), { recursive: true });
    await symlink(outside, join(context.root, "attachments", id));
    await expect(
      addFileAttachment(context, id, { name: "x.txt", data: new Uint8Array(1) }),
    ).rejects.toThrow();
    expect(await Bun.file(join(outside, "x.txt")).exists()).toBe(false);
    const withLink = await addLinkAttachment(context, id, {
      url: "https://example.com/spec",
      name: "Spec",
    });
    expect(withLink.metadata.attachments?.at(-1)).toMatchObject({ kind: "link", name: "Spec" });
    await expect(addLinkAttachment(context, id, { url: "javascript:alert(1)" })).rejects.toThrow(
      "http or https",
    );
  });

  test("sanitises file names", () => {
    expect(sanitizeFileName("../a/b c.txt")).toBe("b c.txt");
    expect(sanitizeFileName("we?ird*.md")).toBe("we_ird_.md");
    expect(sanitizeFileName(".env")).toBe("env");
    expect(sanitizeFileName("x".repeat(300))).toHaveLength(100);
  });
});
