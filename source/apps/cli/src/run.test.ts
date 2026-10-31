import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { resolveLocalAssets } from "#/run";

describe("local dashboard launcher", () => {
  test("prefers the bundled dashboard and runtime assets for installed packages", async () => {
    const packageRoot = await mkdtemp(join(tmpdir(), "task-cli-package-"));
    try {
      const dashboardRoot = join(packageRoot, "dist/assets/local-dashboard");
      await mkdir(join(dashboardRoot, ".next"), { recursive: true });
      await mkdir(join(packageRoot, "dist/assets"), { recursive: true });
      await writeFile(join(packageRoot, "package.json"), '{"name":"@task/cli"}');
      await writeFile(join(dashboardRoot, ".next/BUILD_ID"), "build");
      await writeFile(join(packageRoot, "dist/assets/local-runtime.js"), "");

      expect(resolveLocalAssets(join(packageRoot, "src"))).toEqual({
        cliRoot: packageRoot,
        dashboardRoot,
        runtimeEntry: join(packageRoot, "dist/assets/local-runtime.js"),
        nextEntry: fileURLToPath(import.meta.resolve("next/dist/bin/next")),
      });
    } finally {
      await rm(packageRoot, { recursive: true, force: true });
    }
  });
});
