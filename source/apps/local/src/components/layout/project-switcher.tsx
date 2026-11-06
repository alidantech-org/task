"use client";

import { Button, Input } from "@task/ui";
import {
  Check,
  Folder,
  FolderOpen,
  LayoutDashboard,
  Link2,
  Monitor,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DropdownMenu } from "radix-ui";
import { useCallback, useEffect, useState } from "react";
import { useDialogs } from "@/components/dialogs";
import { CustomSelect } from "@/components/ui/select";

export type SwitcherProject = {
  path: string;
  addedAt: string;
  active?: boolean;
  name?: string;
  color?: number;
};
export type ProjectGroup = { id: string; name: string; icon?: string; paths: string[] };

const noGroup = "__none";
const newGroup = "__new";

function folderName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}
export function projectName(project: SwitcherProject): string {
  return project.name?.trim() || folderName(project.path);
}

/** A plain folder mark keeps project switching visually quiet. */
export function LocalProjectIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Folder
      className={`pj-folder-mark ${className ?? ""}`}
      aria-hidden="true"
      style={{ width: size, height: size }}
    />
  );
}

export function ProjectIcon({
  size = 20,
}: {
  project: Pick<SwitcherProject, "path" | "name">;
  size?: number;
}) {
  return <LocalProjectIcon size={size} />;
}

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/runtime/projects${url}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "The request failed");
  return payload;
}

function AddProjectDialog({
  onClose,
  onAdd,
}: {
  onClose(): void;
  onAdd(path: string): Promise<void>;
}) {
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  async function pickFolder() {
    setPicking(true);
    setError("");
    try {
      const result = await call<{ path: string | null }>("/pick-folder", "POST");
      if (result.path) setPath(result.path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the folder picker");
    } finally {
      setPicking(false);
    }
  }

  async function submitProject() {
    if (!path.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onAdd(path.trim());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="new-task-overlay project-dialog-overlay" />
        <Dialog.Content className="new-task-dialog project-dialog">
          <div className="project-dialog-heading">
            <span className="project-dialog-icon">
              <FolderOpen aria-hidden="true" />
            </span>
            <div>
              <Dialog.Title className="dialog-title">Add a local project</Dialog.Title>
              <Dialog.Description className="sub">
                Link a folder that contains a Task workspace. Your files stay where they are.
              </Dialog.Description>
            </div>
          </div>
          <form
            className="pj-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitProject();
            }}
          >
            <div className="fs-field">
              <span className="fs-label">Folder location</span>
              <div className="pj-path-entry">
                <Input
                  autoFocus
                  value={path}
                  onChange={(event) => setPath(event.target.value)}
                  placeholder="/path/to/project"
                  aria-label="Project folder path"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "project-add-error" : "project-add-help"}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={picking || busy}
                  onClick={() => void pickFolder()}
                >
                  <FolderOpen className="size-4" />
                  {picking ? "Opening…" : "Browse"}
                </Button>
              </div>
              <small className="sub" id="project-add-help">
                Choose a folder from your computer, or enter its full path.
              </small>
            </div>
            {error && (
              <p className="pj-error" id="project-add-error" role="alert">
                {error}
              </p>
            )}
            <div className="pj-actions">
              <Button type="button" variant="outline" disabled={busy || picking} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || picking || !path.trim()}>
                {busy ? "Adding…" : "Add project"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditProjectDialog({
  project,
  groups,
  onClose,
  onSaved,
  onNotice,
}: {
  project: SwitcherProject;
  groups: readonly ProjectGroup[];
  onClose(): void;
  onSaved(): void;
  onNotice(message: string): void;
}) {
  const { prompt } = useDialogs();
  const current = groups.find((group) => group.paths.includes(project.path));
  const [name, setName] = useState(project.name ?? "");
  const [groupId, setGroupId] = useState(current?.id ?? noGroup);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await call(`/trusted/${encodeURIComponent(project.path)}`, "PATCH", {
        name: name.trim() || null,
      });
      let target = groupId;
      if (target === newGroup) {
        const groupName = await prompt({
          title: "New project group",
          label: "Group name",
          placeholder: "For example: Acme app",
          confirmLabel: "Create group",
        });
        if (!groupName) {
          setBusy(false);
          return;
        }
        const created = await call<{ group: ProjectGroup }>("/groups", "POST", {
          name: groupName,
          paths: [],
        });
        target = created.group.id;
      }
      // Leave the old group, then join the chosen one.
      if (current && current.id !== target)
        await call(`/groups/${current.id}`, "PATCH", {
          paths: current.paths.filter((path) => path !== project.path),
        });
      const next = groups.find((group) => group.id === target);
      if (target !== noGroup && !next?.paths.includes(project.path))
        await call(`/groups/${target}`, "PATCH", { paths: [...(next?.paths ?? []), project.path] });
      onSaved();
      onClose();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not save the project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="new-task-overlay project-dialog-overlay" />
        <Dialog.Content className="new-task-dialog">
          <Dialog.Title className="dialog-title">Edit project</Dialog.Title>
          <Dialog.Description className="sr-only">
            Change the project's name and linked group.
          </Dialog.Description>
          <div className="pj-form">
            <div className="pj-preview">
              <ProjectIcon project={{ ...project, name }} size={32} />
              <code title={project.path}>{project.path}</code>
            </div>
            <div className="fs-field">
              <span className="fs-label">Name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={folderName(project.path)}
                maxLength={60}
                aria-label="Project name"
              />
            </div>
            <div className="fs-field">
              <span className="fs-label">Linked group</span>
              <CustomSelect
                label="Linked group"
                value={groupId}
                onValueChange={setGroupId}
                options={[
                  { value: noGroup, label: "Not linked" },
                  ...groups.map((group) => ({ value: group.id, label: group.name })),
                  { value: newGroup, label: "New group…" },
                ]}
              />
              <small className="sub">
                Repos in one group (for example backend and frontend) are shown together on the
                group's dashboard. Each keeps its own tasks and docs.
              </small>
            </div>
            <div className="pj-actions">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Projects listed by name with icons, linked repos grouped, and a plus button to add one. */
export function ProjectList({
  projects,
  onProjects,
  switchProject,
  removeProjectTrust,
  onNotice,
  onNavigate,
  onDialogOpenChange = () => undefined,
}: {
  projects: SwitcherProject[];
  onProjects(projects: SwitcherProject[]): void;
  switchProject(path: string): Promise<void>;
  removeProjectTrust(path: string): Promise<void>;
  onNotice(message: string): void;
  /** Called after a navigation so the switcher can close. */
  onNavigate(): void;
  onDialogOpenChange?(open: boolean): void;
}) {
  const router = useRouter();
  const { confirm, prompt } = useDialogs();
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SwitcherProject | null>(null);

  const reload = useCallback(async () => {
    try {
      const payload = await call<{ projects: SwitcherProject[]; groups: ProjectGroup[] }>(
        "/trusted",
        "GET",
      );
      onProjects(payload.projects);
      setGroups(payload.groups);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load projects");
    }
  }, [onProjects, onNotice]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Load the groups once when the list opens.
  useEffect(() => {
    void reload();
  }, []);

  const grouped = new Set(groups.flatMap((group) => group.paths));
  const loose = projects.filter((project) => !grouped.has(project.path));

  const row = (project: SwitcherProject) => (
    <div className={`pj-row ${project.active ? "on" : ""}`} key={project.path}>
      <button
        type="button"
        className="pj-main"
        title={`${project.path} · Local`}
        aria-label={`${projectName(project)} · Local${project.active ? " · Current project" : " · Switch project"}`}
        disabled={project.active}
        onClick={() => void switchProject(project.path)}
      >
        <ProjectIcon project={project} />
        <span className="pj-project-name">{projectName(project)}</span>
        <small className="pj-local-label">
          <Monitor aria-hidden="true" />
          Local
        </small>
        {project.active ? <Check className="size-4 pj-check" /> : null}
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="pj-more" aria-label={`${projectName(project)} options`}>
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="task-sheet-menu project-actions-menu"
            align="end"
            sideOffset={4}
          >
            <DropdownMenu.Item
              onSelect={() => {
                setEditing(project);
                onDialogOpenChange(true);
              }}
            >
              <Link2 className="size-4" /> Edit name and group
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                void navigator.clipboard
                  .writeText(project.path)
                  .then(() => onNotice("Project folder path copied"))
                  .catch(() => onNotice("Could not copy the project folder path"));
              }}
            >
              <Folder className="size-4" /> Copy folder path
            </DropdownMenu.Item>
            {!project.active && (
              <DropdownMenu.Item
                onSelect={() => void removeProjectTrust(project.path).then(reload)}
              >
                <Trash2 className="size-4" /> Remove from list
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );

  return (
    <div className="pj-list">
      <div className="pj-head">
        <b>Projects</b>
        <button
          type="button"
          className="pj-add"
          aria-label="Add a project"
          title="Add a project"
          onClick={() => {
            setAdding(true);
            onDialogOpenChange(true);
          }}
        >
          <Plus className="size-4" />
        </button>
      </div>
      {groups.map((group) => {
        const members = group.paths
          .map((path) => projects.find((project) => project.path === path))
          .filter((project): project is SwitcherProject => Boolean(project));
        return (
          <div className="pj-group" key={group.id}>
            <div className="pj-group-head">
              <span>
                {group.icon ? `${group.icon} ` : ""}
                {group.name}
              </span>
              <button
                type="button"
                title="Open the group dashboard"
                aria-label={`Open ${group.name} dashboard`}
                onClick={() => {
                  router.push(`/projects?group=${group.id}`);
                  onNavigate();
                }}
              >
                <LayoutDashboard className="size-4" />
              </button>
              <button
                type="button"
                title="Rename group"
                aria-label={`Rename ${group.name}`}
                onClick={() =>
                  void prompt({
                    title: "Rename group",
                    label: "Group name",
                    initial: group.name,
                    confirmLabel: "Rename",
                  }).then((name) => {
                    if (name) void call(`/groups/${group.id}`, "PATCH", { name }).then(reload);
                  })
                }
              >
                <MoreHorizontal className="size-4" />
              </button>
              <button
                type="button"
                title="Delete group (projects stay)"
                aria-label={`Delete ${group.name}`}
                onClick={() =>
                  void confirm({
                    title: `Delete the group “${group.name}”?`,
                    message:
                      "The projects stay in your list; only the link between them is removed.",
                    confirmLabel: "Delete group",
                    danger: true,
                  }).then((ok) => {
                    if (ok) void call(`/groups/${group.id}`, "DELETE").then(reload);
                  })
                }
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            {members.length === 0 ? (
              <small className="sub pj-empty">No projects linked yet.</small>
            ) : (
              members.map(row)
            )}
          </div>
        );
      })}
      {groups.length > 0 && loose.length > 0 ? <div className="pj-group-head">Other</div> : null}
      {loose.map(row)}
      {projects.length === 0 && <p className="sub pj-empty">No projects yet. Use + to add one.</p>}
      {adding && (
        <AddProjectDialog
          onClose={() => {
            setAdding(false);
            onDialogOpenChange(false);
          }}
          onAdd={async (path) => {
            const result = await call<{ project: SwitcherProject }>("/trusted", "POST", { path });
            onProjects([
              ...projects.filter((project) => project.path !== result.project.path),
              result.project,
            ]);
            onNotice(`${projectName(result.project)} added to your projects`);
          }}
        />
      )}
      {editing && (
        <EditProjectDialog
          project={editing}
          groups={groups}
          onClose={() => {
            setEditing(null);
            onDialogOpenChange(false);
          }}
          onSaved={() => void reload()}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}
