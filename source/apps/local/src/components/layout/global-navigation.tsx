"use client";

import { Button, Input } from "@task/ui";
import {
  Check,
  FileText,
  Folder,
  FolderKanban,
  Laptop,
  LayoutDashboard,
  ListTodo,
  Moon,
  Pencil,
  Sun,
  X,
} from "lucide-react";
import Image from "next/image";
import type { Dispatch, SetStateAction } from "react";

type Project = { path: string; addedAt: string; active?: boolean };
type WorkspaceProject = { projectName: string; projectRoot: string } | null;
type ThemeChoice = "system" | "light" | "dark";
type GlobalNavigationProps = {
  section: string;
  selectSection(label: string): void;
  openCreate(date?: string): void;
  workspace: WorkspaceProject;
  projectSwitcherOpen: boolean;
  setProjectSwitcherOpen: Dispatch<SetStateAction<boolean>>;
  projectPathInput: string;
  setProjectPathInput(value: string): void;
  trustedProjects: Project[];
  trustProjectPath(path: string): Promise<void>;
  switchProject(path: string): Promise<void>;
  removeProjectTrust(path: string): Promise<void>;
  theme: ThemeChoice;
  toggleTheme(): void;
};
const globalNavigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Tasks", icon: ListTodo },
  { label: "Groups", icon: FolderKanban },
  { label: "Documents", icon: FileText },
];

export function GlobalNavigation(props: GlobalNavigationProps) {
  const {
    section,
    selectSection,
    openCreate,
    workspace,
    projectSwitcherOpen,
    setProjectSwitcherOpen,
    projectPathInput,
    setProjectPathInput,
    trustedProjects,
    trustProjectPath,
    switchProject,
    removeProjectTrust,
    theme,
    toggleTheme,
  } = props;
  return (
    <aside
      data-slot="global-navigation"
      className="sticky top-2 hidden h-[calc(100svh-1rem)] w-16 shrink-0 flex-col items-center self-start px-2 py-3 md:flex"
    >
      <span aria-label="Task" className="mb-5 grid size-10 place-items-center" role="img">
        <Image src="/task-symbol.svg" alt="" width={36} height={36} priority />
      </span>
      <nav aria-label="Workspace navigation" className="flex w-full flex-col items-center gap-1">
        {globalNavigation.map(({ label, icon: Icon }) => (
          <Button
            key={label}
            variant={section === label ? "secondary" : "ghost"}
            size="icon"
            title={label}
            aria-label={label}
            aria-current={section === label ? "page" : undefined}
            onClick={() => selectSection(label)}
            className="size-10"
          >
            <Icon className="size-4" />
          </Button>
        ))}
      </nav>
      <div className="mt-3 w-full border-t border-border/60 pt-3">
        <Button
          variant="ghost"
          size="icon"
          title="Create task"
          aria-label="Create task"
          onClick={() => openCreate()}
          className="mx-auto flex size-10"
        >
          <Pencil className="size-4" />
        </Button>
      </div>
      <div className="mt-auto mb-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Theme: ${theme}`}
          title={`Theme: ${theme}`}
          onClick={toggleTheme}
          className="size-10"
        >
          {theme === "system" ? (
            <Laptop className="size-4" />
          ) : theme === "light" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </div>
      <div className="relative" data-slot="project-switcher">
        <Button
          variant={projectSwitcherOpen ? "secondary" : "ghost"}
          size="icon"
          aria-label={`Project switcher: ${workspace?.projectName ?? "no project selected"}`}
          aria-haspopup="menu"
          aria-expanded={projectSwitcherOpen}
          title={workspace?.projectName ?? "Project switcher"}
          onClick={() => setProjectSwitcherOpen((open) => !open)}
          className="size-10"
        >
          <FolderKanban className="size-4" />
        </Button>
        {projectSwitcherOpen && (
          <div className="absolute bottom-0 left-12 z-50 w-[min(22rem,calc(100vw-5rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
              <span className="text-xs font-medium">Trusted projects</span>
            </div>
            <form
              className="space-y-2 border-b border-border/60 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (projectPathInput.trim()) void trustProjectPath(projectPathInput.trim());
              }}
            >
              <label htmlFor="trusted-project-path" className="text-[11px] text-muted-foreground">
                Add a project folder
              </label>
              <div className="flex gap-2">
                <Input
                  id="trusted-project-path"
                  value={projectPathInput}
                  onChange={(event) => setProjectPathInput(event.target.value)}
                  placeholder="/path/to/project"
                  className="h-9 min-w-0 text-xs"
                />
                <Button type="submit" size="sm" disabled={!projectPathInput.trim()}>
                  Trust
                </Button>
              </div>
            </form>
            {workspace &&
              !trustedProjects.some((project) => project.path === workspace.projectRoot) && (
                <button
                  type="button"
                  onClick={() => void trustProjectPath(workspace.projectRoot)}
                  className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2.5 text-left hover:bg-accent/60"
                >
                  <FolderKanban className="size-4" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {workspace.projectName} · Current
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      Trust this project
                    </span>
                  </span>
                </button>
              )}
            <div className="max-h-72 overflow-y-auto">
              {trustedProjects.map((project) => (
                <div
                  key={project.path}
                  className="flex items-center gap-1 border-b border-border/50 px-2 last:border-0"
                >
                  <button
                    type="button"
                    disabled={project.active}
                    onClick={() => void switchProject(project.path)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-1 py-2 text-left hover:bg-accent/50 disabled:opacity-70"
                  >
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-xs">{project.path}</span>
                    {project.active && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                  {!project.active && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove trust for ${project.path}`}
                      title="Remove trust"
                      onClick={() => void removeProjectTrust(project.path)}
                      className="size-7"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {trustedProjects.length === 0 && !workspace && (
                <p className="px-3 py-4 text-xs text-muted-foreground">No trusted projects yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
