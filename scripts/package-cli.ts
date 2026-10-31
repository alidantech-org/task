import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const cliRoot = join(repositoryRoot, "source/apps/cli");
const localRoot = join(repositoryRoot, "source/apps/local");
const buildRoot = await mkdtemp(join(repositoryRoot, ".task-cli-release-build-"));
const stagedRoot = join(buildRoot, "cli-dist");
const assetRoot = join(stagedRoot, "assets");
const buildLocalRoot = join(buildRoot, "source/apps/local");
await mkdir(stagedRoot, { recursive: true });

function run(label: string, command: string[], cwd = repositoryRoot): void {
  process.stdout.write(`\n› ${label}\n`);
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${result.exitCode ?? 1}`);
  }
}

try {
  await cp(localRoot, buildLocalRoot, {
    recursive: true,
    filter: (path) =>
      !path
        .split(/[\\/]/)
        .some(
          (part) => part === "node_modules" || part === ".next" || part.endsWith(".tsbuildinfo"),
        ),
  });
  await mkdir(join(buildRoot, "source/packages"), { recursive: true });
  await symlink(join(repositoryRoot, "source/packages/ui"), join(buildRoot, "source/packages/ui"));
  await symlink(join(localRoot, "node_modules"), join(buildLocalRoot, "node_modules"));
  await cp(join(repositoryRoot, "package.json"), join(buildRoot, "package.json"));
  await cp(join(repositoryRoot, "bun.lock"), join(buildRoot, "bun.lock"));
  await cp(join(repositoryRoot, "tsconfig.json"), join(buildRoot, "tsconfig.json"));

  await mkdir(assetRoot, { recursive: true });
  const nextEntry = join(localRoot, "node_modules/next/dist/bin/next");
  run(
    "Build the production local dashboard in an isolated checkout",
    ["node", nextEntry, "build"],
    buildLocalRoot,
  );

  const runtimeBuild = await Bun.build({
    entrypoints: [join(localRoot, "src/server.ts")],
    outdir: assetRoot,
    naming: "local-runtime.js",
    target: "bun",
    minify: false,
    packages: "bundle",
  });
  if (!runtimeBuild.success) {
    throw new Error(runtimeBuild.logs.map((log) => log.message).join("\n"));
  }

  const cliBuild = await Bun.build({
    entrypoints: [join(cliRoot, "src/index.ts")],
    outdir: stagedRoot,
    naming: "cli.js",
    target: "bun",
    minify: false,
    packages: "bundle",
    external: ["@opentui/core", "@opentui/react"],
  });
  if (!cliBuild.success) {
    throw new Error(cliBuild.logs.map((log) => log.message).join("\n"));
  }
  const cliEntry = join(stagedRoot, "cli.js");
  const cliSource = (await Bun.file(cliEntry).text())
    .replace(/^\/\/ @bun\r?\n/, "")
    .replace(/^#!\/usr\/bin\/env bun\r?\n/, "");
  await Bun.write(cliEntry, `#!/usr/bin/env bun\n${cliSource}`);

  const tuiBuild = await Bun.build({
    entrypoints: [join(repositoryRoot, "source/apps/tui/src/index.tsx")],
    outdir: stagedRoot,
    naming: "tui-entry.js",
    target: "bun",
    minify: false,
    packages: "bundle",
    external: ["@opentui/core", "@opentui/react", "react"],
  });
  if (!tuiBuild.success) {
    throw new Error(tuiBuild.logs.map((log) => log.message).join("\n"));
  }

  const dashboardRoot = join(assetRoot, "local-dashboard");
  await mkdir(dashboardRoot, { recursive: true });
  await cp(join(buildLocalRoot, ".next"), join(dashboardRoot, ".next"), {
    recursive: true,
    filter: (path) => !path.split(/[\\/]/).some((part) => part === "dev" || part === "cache"),
  });
  await cp(join(buildLocalRoot, "public"), join(dashboardRoot, "public"), { recursive: true });
  await cp(join(buildLocalRoot, "next.config.ts"), join(dashboardRoot, "next.config.ts"));
  await cp(join(buildLocalRoot, "package.json"), join(dashboardRoot, "package.json"));

  const buildId = await Bun.file(join(dashboardRoot, ".next/BUILD_ID")).text();
  if (!buildId.trim()) throw new Error("Next.js production build did not produce a BUILD_ID");

  await rm(join(cliRoot, "dist"), { recursive: true, force: true });
  await cp(stagedRoot, join(cliRoot, "dist"), { recursive: true });
  process.stdout.write("\nCLI release assets are ready in source/apps/cli/dist.\n");
} finally {
  await rm(buildRoot, { recursive: true, force: true });
}
