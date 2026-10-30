export interface CliMetadata {
  name: "task";
  version: string;
  aliases: readonly ["task", "tk"];
  status: "foundation";
  commands: readonly string[];
}

export function getCliMetadata(version: string): CliMetadata {
  return {
    name: "task",
    version,
    aliases: ["task", "tk"],
    status: "foundation",
    commands: ["doctor", "help", "version"],
  };
}

export function resolveCommand(args: readonly string[]): string | undefined {
  return args.find((argument) => !argument.startsWith("-"));
}
