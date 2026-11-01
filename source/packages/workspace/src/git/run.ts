import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type GitResult = {
  code: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
};

export type GitOptions = {
  env?: Record<string, string>;
  maxBytes?: number;
  timeoutMs?: number;
};

const defaultMaxBytes = 4_000_000;
const defaultTimeoutMs = 30_000;

function baseEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
  };
  for (const key of ["PATH", "HOME", "XDG_CONFIG_HOME", "SYSTEMROOT"]) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  return environment;
}

async function readCapped(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  onOverflow: () => void,
): Promise<{ text: string; truncated: boolean }> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (truncated) continue;
    size += value.byteLength;
    if (size > maxBytes) {
      truncated = true;
      onOverflow();
      continue;
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString("utf8"), truncated };
}

/** Runs git with an argument array (never a shell), a fixed working directory, a timeout and capped output. */
export async function runGit(
  cwd: string,
  args: readonly string[],
  options: GitOptions = {},
): Promise<GitResult> {
  let process_: ReturnType<typeof Bun.spawn>;
  try {
    process_ = Bun.spawn(["git", ...args], {
      cwd,
      env: { ...baseEnvironment(), ...options.env },
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
  } catch {
    return { code: 127, stdout: "", stderr: "git is not available", truncated: false };
  }
  const timer = setTimeout(() => process_.kill(), options.timeoutMs ?? defaultTimeoutMs);
  try {
    const maxBytes = options.maxBytes ?? defaultMaxBytes;
    const [out, err] = await Promise.all([
      readCapped(process_.stdout as ReadableStream<Uint8Array>, maxBytes, () => process_.kill()),
      readCapped(process_.stderr as ReadableStream<Uint8Array>, 100_000, () => undefined),
    ]);
    const code = await process_.exited;
    return { code, stdout: out.text, stderr: err.text, truncated: out.truncated };
  } finally {
    clearTimeout(timer);
  }
}

/** Runs a callback with a private temporary directory that is always removed afterwards. */
export async function withTemporaryDirectory<T>(
  callback: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "task-git-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
