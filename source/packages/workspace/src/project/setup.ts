import { randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { WorkspaceError } from "@task/workspace/errors";
import { serializeMarkdown } from "@task/workspace/indexing/metadata";
import type { WorkspaceContext } from "@task/workspace/indexing/types";
import { resolveSafeWorkspacePath } from "@task/workspace/paths/safe-path";
import Handlebars from "handlebars";
import ignore from "ignore";

export type ProjectFact = { key: string; value: string; evidence: string[] };
export type ProjectFinding = { id: string; title: string; reason: string; evidence: string[] };
export type ProjectInspection = {
  schemaVersion: 1;
  projectRoot: string;
  facts: ProjectFact[];
  findings: ProjectFinding[];
};
export type SetupSelection = {
  documentation?: readonly string[];
  rules?: readonly string[];
  agents?: readonly string[];
  gitGuidance?: string;
};
export type SetupChange = {
  path: string;
  content: string;
  purpose: string;
  mode: "create" | "managed-section";
};
export type ProjectSetupPlan = {
  schemaVersion: 1;
  projectRoot: string;
  workspaceRoot: string;
  inspection: ProjectInspection;
  selection: SetupSelection;
  changes: SetupChange[];
};

const ignored = new Set([
  ".git",
  ".task",
  ".tasks-cache",
  ".cache",
  "node_modules",
  "vendor",
  "build",
  "dist",
  ".next",
  ".dart_tool",
  "coverage",
  "tmp",
  "temp",
  "target",
  "out",
]);
const manifestNames = [
  "package.json",
  "pubspec.yaml",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "composer.json",
];
const lockNames = [
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  "poetry.lock",
  "pubspec.lock",
];
const agentTargets: Record<string, string> = {
  codex: "AGENTS.md",
  claude: "CLAUDE.md",
  copilot: ".github/copilot-instructions.md",
  cursor: ".cursor/rules/task-project.mdc",
  skill: ".agents/skills/project-guide/SKILL.md",
};

async function projectFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (
    directory: string,
    prefix: string,
    inherited: readonly { base: string; matcher: ReturnType<typeof ignore> }[],
  ): Promise<void> => {
    const ignorePath = join(directory, ".gitignore");
    let localIgnore = "";
    try {
      const stat = await lstat(ignorePath);
      if (stat.isFile() && !stat.isSymbolicLink()) localIgnore = await readFile(ignorePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const active = localIgnore
      ? [...inherited, { base: prefix, matcher: ignore().add(localIgnore) }]
      : inherited;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
      const ignoredByRule = active.some(({ base, matcher }) => {
        const localPath = base ? relative(base, path).split(sep).join("/") : path;
        return matcher.ignores(entry.isDirectory() ? `${localPath}/` : localPath);
      });
      if (ignoredByRule) continue;
      if (entry.isDirectory()) await walk(join(directory, entry.name), path, active);
      else if (entry.isFile()) files.push(path);
    }
  };
  await walk(root, "", []);
  return files.sort();
}

export async function inspectProject(projectRoot: string): Promise<ProjectInspection> {
  const root = resolve(projectRoot);
  const files = await projectFiles(root);
  const set = new Set(files);
  const facts: ProjectFact[] = [];
  const add = (key: string, value: string, evidence: string[]): void => {
    const current = facts.find((fact) => fact.key === key && fact.value === value);
    if (current) current.evidence = [...new Set([...current.evidence, ...evidence])].slice(0, 20);
    else facts.push({ key, value, evidence: evidence.slice(0, 20) });
  };
  for (const name of manifestNames) {
    const found = files.filter((path) => path === name || path.endsWith(`/${name}`));
    if (!found.length) continue;
    add("manifest", name, found.slice(0, 20));
    if (name === "package.json") {
      for (const path of found.slice(0, 10)) {
        try {
          const manifest = JSON.parse(await readFile(join(root, path), "utf8")) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            scripts?: Record<string, string>;
          };
          const deps = { ...manifest.dependencies, ...manifest.devDependencies };
          for (const [dependency, framework] of [
            ["next", "Next.js"],
            ["react", "React"],
            ["vite", "Vite"],
            ["@nestjs/core", "NestJS"],
            ["express", "Express"],
          ])
            if (deps[dependency]) add("framework", framework, [path]);
          for (const script of Object.keys(manifest.scripts ?? {}))
            if (["test", "lint", "typecheck", "build", "check", "format"].includes(script))
              add("script", script, [path]);
        } catch {
          add("manifest-warning", `Could not parse ${path}`, [path]);
        }
      }
    }
  }
  for (const name of lockNames) if (set.has(name)) add("lockfile", name, [name]);
  for (const path of files) {
    if (/^(\.github\/workflows\/.*\.(yml|yaml)|\.gitlab-ci\.yml|Jenkinsfile)$/.test(path))
      add("ci", "CI configuration", [path]);
    if (/^(README(?:\.[^/]*)?\.md)$/.test(path)) add("guidance", "README documentation", [path]);
    if (/(^|\/)(AGENTS\.md|CLAUDE\.md)$/.test(path))
      add("guidance", "Agent instruction file", [path]);
    if (
      /^\.github\/(copilot-instructions\.md|instructions\/.*\.instructions\.md)$/.test(path) ||
      /^\.cursor\/rules\/.*\.mdc$/.test(path) ||
      /^\.claude\/rules\/.*\.md$/.test(path) ||
      /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(path)
    )
      add("guidance", "Agent-specific instructions or skills", [path]);
    if (path.toLowerCase().endsWith(".md") && !/(^|\/)(AGENTS|CLAUDE)\.md$/.test(path))
      add("documentation", "Markdown documentation", [path]);
    if (/^(?:src|source|app|lib)\//.test(path)) add("source-layout", path.split("/")[0], [path]);
    if (
      /^(?:.*\.)?(?:test|spec)\.[cm]?[jt]sx?$/.test(path) ||
      /(^|\/)(__tests__|test|tests)\//.test(path)
    )
      add("tests", "Test files", [path]);
    if (
      /^(?:biome\.json|\.eslintrc|eslint\.config\.|\.prettierrc|prettier\.config\.|analysis_options\.yaml|ruff\.toml|\.ruff\.toml)/.test(
        path,
      )
    )
      add("quality-config", "Quality configuration", [path]);
  }
  const uniq = new Map(facts.map((fact) => [`${fact.key}:${fact.value}`, fact]));
  const normalizedFacts = [...uniq.values()];
  const findings: ProjectFinding[] = [];
  const has = (key: string): ProjectFact[] => normalizedFacts.filter((fact) => fact.key === key);
  if (!set.has("README.md"))
    findings.push({
      id: "project-readme",
      title: "Project README",
      reason: "No root README was detected.",
      evidence: [],
    });
  if (!has("tests").length)
    findings.push({
      id: "testing-guide",
      title: "Testing guide",
      reason: "No test files or test directories were detected.",
      evidence: [],
    });
  if (!has("quality-config").length)
    findings.push({
      id: "quality-rules",
      title: "Code quality rules",
      reason: "No common formatting or lint configuration was detected.",
      evidence: [],
    });
  if (!has("ci").length)
    findings.push({
      id: "git-guidance",
      title: "Git and review guidance",
      reason:
        "No CI configuration was detected; document project-specific commit and review expectations if useful.",
      evidence: [],
    });
  findings.push({
    id: "repository-map",
    title: "Repository map",
    reason: "Summarize the detected top-level source and tooling layout.",
    evidence: normalizedFacts
      .filter((fact) => fact.key === "source-layout")
      .flatMap((fact) => fact.evidence)
      .slice(0, 20),
  });
  return { schemaVersion: 1, projectRoot: root, facts: normalizedFacts, findings };
}

export async function renderTemplate(
  name: string,
  values: Record<string, unknown>,
  context: WorkspaceContext,
): Promise<string> {
  Handlebars.registerHelper("eq", (left: string, right: string) => left === right);
  const custom = await resolveSafeWorkspacePath(context.root, `agents/templates/${name}`);
  let template: string;
  try {
    template = await readFile(custom, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    template = await readFile(join(import.meta.dir, "templates", name), "utf8");
  }
  return Handlebars.compile(template, { noEscape: true })(values);
}

export function managedSection(target: string, content: string): string {
  const marker = target.replace(/[^a-z0-9.-]/gi, "-").toUpperCase();
  return `<!-- BEGIN TASK MANAGED ${marker} -->\n${content.trim()}\n<!-- END TASK MANAGED ${marker} -->`;
}

export async function createProjectSetupPlan(
  context: WorkspaceContext,
  selection: SetupSelection,
): Promise<ProjectSetupPlan> {
  const projectRoot = resolve(context.projectRoot ?? context.root);
  if (
    resolve(context.root) === projectRoot &&
    ((selection.documentation?.length ?? 0) > 0 ||
      (selection.rules?.length ?? 0) > 0 ||
      (selection.agents?.length ?? 0) > 0)
  ) {
    throw new WorkspaceError(
      "invalid_input",
      "Project setup needs a nested Task workspace so its Markdown stays separate from root README and agent adapter files; run task init or select a nested workspace such as .tasks",
    );
  }
  const inspection = await inspectProject(projectRoot);
  const changes: SetupChange[] = [];
  const facts = inspection.facts.map((fact) => ({
    key: fact.key,
    value: fact.value,
    evidence: fact.evidence,
  }));
  const data = {
    projectName: projectRoot.split(sep).at(-1) ?? "Project",
    workspacePath: relative(projectRoot, resolve(context.root)).split(sep).join("/"),
    facts,
    gitGuidance:
      selection.gitGuidance ??
      "Follow the repository's existing branch, commit, and review conventions. Do not change Git configuration or install hooks.",
  };
  const documentTitles: Record<string, string> = {
    "project-overview": "Project overview",
    "repository-map": "Repository map",
    "development-setup": "Development setup",
    "testing-guide": "Testing guide",
  };
  const documentTemplates: Record<string, string> = {
    "project-overview": "project-overview.hbs",
    "repository-map": "repository-map.hbs",
    "development-setup": "development-setup.hbs",
    "testing-guide": "testing-guide.hbs",
  };
  for (const doc of selection.documentation ?? [])
    if (!documentTitles[doc])
      throw new WorkspaceError("invalid_input", `Unknown project document: ${doc}`);
  for (const doc of selection.documentation ?? []) {
    const content = await renderTemplate(documentTemplates[doc], data, context);
    const path = `docs/${doc}.md`;
    changes.push({
      path,
      content: serializeMarkdown(
        {
          id: `DOC-${doc.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
          name: documentTitles[doc],
          type: "documentation",
          extra: {
            generated_by: "task setup",
            evidence: inspection.facts.flatMap((fact) => fact.evidence).slice(0, 40),
          },
        },
        content,
      ),
      purpose: `Document ${doc.replaceAll("-", " ")} from detected repository facts.`,
      mode: "create",
    });
  }
  for (const rule of selection.rules ?? [])
    if (!["coding", "testing", "security", "git"].includes(rule))
      throw new WorkspaceError("invalid_input", `Unknown project rule: ${rule}`);
  for (const rule of selection.rules ?? []) {
    const title =
      rule === "testing"
        ? "Testing rules"
        : rule === "security"
          ? "Security rules"
          : rule === "git"
            ? "Git behavior rules"
            : "Project coding rules";
    const body =
      rule === "testing"
        ? "Run the repository's documented checks before reporting work complete. Add or update tests for behavior changes; do not claim checks that were not run."
        : rule === "security"
          ? "Do not expose secrets. Validate untrusted input at boundaries. Preserve existing security controls and report security-sensitive changes."
          : rule === "git"
            ? data.gitGuidance
            : "Follow existing project conventions. Keep changes focused, preserve user edits, and use evidence from the repository when documenting behavior.";
    const path = `rules/${rule}.md`;
    changes.push({
      path,
      content: serializeMarkdown(
        {
          id: `RULE-${rule.toUpperCase()}`,
          name: title,
          type: "rule",
          tags: [rule],
          extra: { source: "task setup" },
        },
        `# ${title}\n\n${body}\n`,
      ),
      purpose: `Add reviewed ${rule} guidance to the Task workspace.`,
      mode: "create",
    });
  }
  for (const agent of selection.agents ?? []) {
    const target = agentTargets[agent];
    if (!target) throw new WorkspaceError("invalid_input", `Unknown agent target: ${agent}`);
    const content = await renderTemplate(
      agent === "skill"
        ? "skill.hbs"
        : agent === "cursor"
          ? "cursor-rule.hbs"
          : "agent-guidance.hbs",
      data,
      context,
    );
    if (agent === "skill") {
      changes.push({
        path: target,
        content: content.replaceAll("{{projectName}}", String(data.projectName)),
        purpose: "Create a portable Agent Skill using the SKILL.md format.",
        mode: "create",
      });
    } else if (agent === "cursor") {
      changes.push({
        path: target,
        content,
        purpose:
          "Create a native Cursor MDC rule with its required frontmatter at the start of the file.",
        mode: "create",
      });
    } else {
      changes.push({
        path: target,
        content: managedSection(target, content),
        purpose: `Add a managed ${agent} guidance section while preserving surrounding content.`,
        mode: "managed-section",
      });
    }
  }
  if (selection.agents?.length) {
    const profile = await renderTemplate("agent-guidance.hbs", data, context);
    changes.push({
      path: "agents/project-guide.md",
      content: serializeMarkdown(
        {
          id: "AGENT-PROJECT-GUIDE",
          name: "Project agent profile",
          type: "agent-profile",
          tags: ["project", "agent-guidance"],
          extra: { generated_by: "task setup", targets: [...selection.agents] },
        },
        profile,
      ),
      purpose:
        "Store the portable agent profile in the Task workspace as the source for generated adapters.",
      mode: "create",
    });
  }
  if (selection.documentation?.length || selection.rules?.length || selection.agents?.length) {
    const workspacePath = relative(projectRoot, resolve(context.root)).split(sep).join("/");
    const documentLinks = (selection.documentation ?? [])
      .map((doc) => `- [${documentTitles[doc]}](${workspacePath}/docs/${doc}.md)`)
      .join("\n");
    const links = [
      documentLinks,
      ...(selection.rules?.length ? [`- [Task rules](${workspacePath}/rules/)`] : []),
      ...(selection.agents?.length ? [`- [Agent profiles](${workspacePath}/agents/)`] : []),
    ]
      .filter(Boolean)
      .join("\n");
    const section = `<!-- BEGIN TASK MANAGED LINKS -->\n## Project guidance\n\n${links}\n<!-- END TASK MANAGED LINKS -->`;
    changes.push({
      path: "README.md",
      content: section,
      purpose: "Add or refresh a clearly marked project-guidance link section.",
      mode: "managed-section",
    });
  }
  return {
    schemaVersion: 1,
    projectRoot,
    workspaceRoot: resolve(context.root),
    inspection,
    selection,
    changes,
  };
}

function within(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

export async function applyProjectSetupPlan(
  plan: ProjectSetupPlan,
): Promise<{ written: string[]; conflicts: string[] }> {
  if (
    typeof plan !== "object" ||
    plan === null ||
    plan.schemaVersion !== 1 ||
    typeof plan.projectRoot !== "string" ||
    typeof plan.workspaceRoot !== "string" ||
    resolve(plan.projectRoot) !== plan.projectRoot ||
    resolve(plan.workspaceRoot) !== plan.workspaceRoot ||
    !within(plan.projectRoot, plan.workspaceRoot) ||
    typeof plan.inspection !== "object" ||
    plan.inspection === null ||
    plan.inspection.projectRoot !== plan.projectRoot ||
    !Array.isArray(plan.changes) ||
    plan.changes.some(
      (change) =>
        typeof change !== "object" ||
        change === null ||
        typeof change.path !== "string" ||
        typeof change.content !== "string" ||
        typeof change.purpose !== "string" ||
        !["create", "managed-section"].includes(change.mode),
    )
  )
    throw new WorkspaceError("invalid_input", "Invalid or unsupported setup plan");
  if (
    (await realpath(plan.projectRoot)) !== plan.projectRoot ||
    (await realpath(plan.workspaceRoot)) !== plan.workspaceRoot
  )
    throw new WorkspaceError(
      "path_not_safe",
      "Project or workspace root changed since setup planning",
    );
  const written: string[] = [];
  const conflicts: string[] = [];
  for (const change of plan.changes) {
    if (isAbsolute(change.path) || change.path.split(/[\\/]/).includes(".."))
      throw new WorkspaceError("path_not_safe", `Unsafe setup target: ${change.path}`);
    const workspaceTarget = /^(docs|rules|agents)\/[a-z0-9._/-]+\.md$/i.test(change.path);
    const projectTarget =
      change.path === "README.md" ||
      [
        "AGENTS.md",
        "CLAUDE.md",
        ".github/copilot-instructions.md",
        ".cursor/rules/task-project.mdc",
        ".agents/skills/project-guide/SKILL.md",
      ].includes(change.path) ||
      /^\.github\/instructions\/[a-z0-9._-]+\.instructions\.md$/i.test(change.path);
    if (!workspaceTarget && !projectTarget)
      throw new WorkspaceError("path_not_safe", `Unsupported setup target: ${change.path}`);
    const base = workspaceTarget ? plan.workspaceRoot : plan.projectRoot;
    const target = resolve(base, change.path);
    if (!within(base, target))
      throw new WorkspaceError("path_not_safe", `Setup target escapes root: ${change.path}`);
    let cursor = base;
    for (const part of relative(base, dirname(target)).split(sep).filter(Boolean)) {
      cursor = join(cursor, part);
      try {
        const stat = await lstat(cursor);
        if (stat.isSymbolicLink() || !stat.isDirectory())
          throw new WorkspaceError("path_not_safe", `Unsafe setup directory: ${cursor}`);
      } catch (error) {
        if (error instanceof WorkspaceError) throw error;
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await mkdir(cursor);
      }
    }
    let targetStat: Awaited<ReturnType<typeof lstat>> | undefined;
    try {
      targetStat = await lstat(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (targetStat && (targetStat.isSymbolicLink() || !targetStat.isFile()))
      throw new WorkspaceError(
        "path_not_safe",
        `Setup target is not a regular file: ${change.path}`,
      );
    const exists = targetStat !== undefined;
    let content = change.content;
    let expectedHash: string | undefined;
    if (exists && change.mode === "managed-section") {
      const current = await readFile(target, "utf8");
      const marker = /<!-- BEGIN TASK MANAGED ([A-Z0-9.-]+) -->/.exec(change.content)?.[1];
      if (!marker)
        throw new WorkspaceError("invalid_input", `Managed section has no marker: ${change.path}`);
      const matching = new RegExp(
        `<!-- BEGIN TASK MANAGED ${marker.replaceAll(".", "\\.")} -->[\\s\\S]*?<!-- END TASK MANAGED ${marker.replaceAll(".", "\\.")} -->`,
      );
      if (matching.test(current)) content = current.replace(matching, () => change.content);
      else content = `${current.trimEnd()}\n\n${change.content}\n`;
      expectedHash = new Bun.CryptoHasher("sha256").update(current).digest("hex");
    } else if (exists) {
      conflicts.push(change.path);
      continue;
    } else if (change.path === "README.md") {
      content = `# ${basename(plan.projectRoot)}\n\n${change.content}\n`;
    }
    const temporary = `${target}.task-${randomUUID()}.tmp`;
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(content, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      if (exists) {
        const latestStat = await lstat(target);
        if (
          latestStat.isSymbolicLink() ||
          !latestStat.isFile() ||
          latestStat.dev !== targetStat?.dev ||
          latestStat.ino !== targetStat?.ino
        )
          throw new WorkspaceError(
            "conflict",
            `Setup target changed while applying: ${change.path}`,
          );
        const latestContent = await readFile(target, "utf8");
        const latestHash = new Bun.CryptoHasher("sha256").update(latestContent).digest("hex");
        if (latestHash !== expectedHash)
          throw new WorkspaceError(
            "conflict",
            `Setup target content changed while applying: ${change.path}`,
          );
        await rename(temporary, target);
      } else {
        try {
          await link(temporary, target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          conflicts.push(change.path);
          continue;
        }
      }
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
    written.push(change.path);
  }
  return { written, conflicts };
}
