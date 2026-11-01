import { userInfo } from "node:os";
import {
  appendComment,
  parseComments,
  removeComment,
  type TaskComment,
} from "@task/workspace/documents/comments";
import { readWorkspaceDocument } from "@task/workspace/documents/read";
import { WorkspaceError } from "@task/workspace/errors";
import { runGit } from "@task/workspace/git/run";
import { buildWorkspaceIndex } from "@task/workspace/indexing/incremental";
import { parseFrontmatter } from "@task/workspace/indexing/metadata";
import type { DocumentSummary, WorkspaceContext } from "@task/workspace/indexing/types";
import { replaceDocumentBody } from "@task/workspace/operations/mutate";
import { findDocument } from "@task/workspace/operations/query";

/** Who is writing: task.yaml identity, TASK_AUTHOR, git's user.name, then the operating system user. */
export async function resolveAuthor(context: WorkspaceContext): Promise<string> {
  const configured = context.config?.identity?.name?.trim();
  if (configured) return configured;
  const fromEnvironment = process.env.TASK_AUTHOR?.trim();
  if (fromEnvironment) return fromEnvironment;
  const git = await runGit(context.projectRoot ?? context.root, ["config", "user.name"]);
  const fromGit = git.code === 0 ? git.stdout.trim() : "";
  if (fromGit) return fromGit;
  try {
    return userInfo().username;
  } catch {
    return "unknown";
  }
}

async function loadBody(
  context: WorkspaceContext,
  identifier: string,
): Promise<{ task: DocumentSummary; body: string }> {
  const task = findDocument(await buildWorkspaceIndex(context), identifier);
  if (task.metadata.type !== "task")
    throw new WorkspaceError("invalid_input", `${identifier} is not a task`);
  return { task, body: parseFrontmatter(await readWorkspaceDocument(context, task.path)).body };
}

export async function listTaskComments(
  context: WorkspaceContext,
  identifier: string,
): Promise<TaskComment[]> {
  return parseComments((await loadBody(context, identifier)).body);
}

export async function addTaskComment(
  context: WorkspaceContext,
  identifier: string,
  text: string,
  author?: string,
  expectedHash?: string,
): Promise<{ task: DocumentSummary; comments: TaskComment[] }> {
  if (!text.trim()) throw new WorkspaceError("invalid_input", "A comment cannot be empty");
  if (text.length > 20_000)
    throw new WorkspaceError("invalid_input", "A comment is limited to 20000 characters");
  const { task, body } = await loadBody(context, identifier);
  const next = appendComment(body, {
    at: new Date().toISOString(),
    author: (author ?? (await resolveAuthor(context))).replace(/[\r\n]+/g, " ").trim() || "unknown",
    text,
  });
  const updated = await replaceDocumentBody(
    context,
    identifier,
    next,
    expectedHash ?? task.contentHash,
  );
  return { task: updated, comments: parseComments(next) };
}

export async function deleteTaskComment(
  context: WorkspaceContext,
  identifier: string,
  index: number,
  expectedHash?: string,
): Promise<{ task: DocumentSummary; comments: TaskComment[] }> {
  const { task, body } = await loadBody(context, identifier);
  let next: string;
  try {
    next = removeComment(body, index);
  } catch (error) {
    throw new WorkspaceError(
      "not_found",
      error instanceof Error ? error.message : "No such comment",
      {
        cause: error,
      },
    );
  }
  const updated = await replaceDocumentBody(
    context,
    identifier,
    next,
    expectedHash ?? task.contentHash,
  );
  return { task: updated, comments: parseComments(next) };
}
