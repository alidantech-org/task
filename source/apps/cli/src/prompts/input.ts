import { cancel, isCancel, text } from "@clack/prompts";

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function promptText(message: string, placeholder?: string): Promise<string> {
  if (!isInteractive())
    throw new Error(
      `Non-interactive use requires ${placeholder ? `--${placeholder}` : "explicit arguments"}`,
    );
  const answer = await text({ message, placeholder });
  if (isCancel(answer)) {
    cancel("Cancelled");
    process.exit(130);
  }
  return answer;
}
