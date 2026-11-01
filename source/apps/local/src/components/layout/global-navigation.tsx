"use client";
import {
  Calendar,
  ChevronLeft,
  File,
  Folder,
  FolderKanban,
  LayoutGrid,
  ListChecks,
  Sparkles,
} from "lucide-react";
import {
  type Dispatch,
  Fragment,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ProjectIcon,
  ProjectList,
  projectName,
  type SwitcherProject,
} from "@/components/layout/project-switcher";
import { topLevelFolders } from "@/lib/markdown";

type Project = SwitcherProject;
type WorkspaceProject = { projectName: string; projectRoot: string } | null;
type NavGroup = { id: string; name: string; path: string; total: number };
type GlobalNavigationProps = {
  section: string;
  selectSection(label: string): void;
  workspace: WorkspaceProject;
  projectSwitcherOpen: boolean;
  setProjectSwitcherOpen: Dispatch<SetStateAction<boolean>>;
  projectPathInput: string;
  setProjectPathInput(value: string): void;
  trustedProjects: Project[];
  setTrustedProjects(projects: Project[]): void;
  setNotice(message: string): void;
  trustProjectPath(path: string): Promise<void>;
  switchProject(path: string): Promise<void>;
  removeProjectTrust(path: string): Promise<void>;
  sidebarCompact: boolean;
  toggleSidebarCompact(): void;
  taskCount: number;
  documentCount: number;
  taskGroups: NavGroup[];
  taskGroupFilter: string;
  selectTaskGroup(groupId: string): void;
  documentPaths: string[];
  /** Files directly in the workspace root; they are files, not folders. */
  rootDocuments: { id: string; path: string }[];
  openDocument(id: string): void;
  activeDocumentId: string | null;
  documentFolder: string;
  selectDocumentFolder(folder: string): void;
};
const globalNavigation = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Tasks", icon: ListChecks },
  { label: "Calendar", icon: Calendar },
  { label: "Groups", icon: Folder },
  { label: "Documents", icon: File },
];

export function GlobalNavigation(props: GlobalNavigationProps) {
  const {
    section,
    selectSection,
    workspace,
    projectSwitcherOpen,
    setProjectSwitcherOpen,
    trustedProjects,
    setTrustedProjects,
    setNotice,
    trustProjectPath,
    switchProject,
    removeProjectTrust,
    sidebarCompact,
    toggleSidebarCompact,
    taskCount,
    documentCount,
    taskGroups,
    taskGroupFilter,
    selectTaskGroup,
    documentPaths,
    rootDocuments,
    openDocument,
    activeDocumentId,
    documentFolder,
    selectDocumentFolder,
  } = props;
  const activeProject = trustedProjects.find((project) => project.active);
  const switcherRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!projectSwitcherOpen) {
      setPopoverPosition(null);
      return;
    }
    const updatePosition = () => {
      const trigger = switcherRef.current?.querySelector("button");
      const popover = popoverRef.current;
      if (!trigger || !popover) return;
      const bounds = trigger.getBoundingClientRect();
      const width = popover.getBoundingClientRect().width;
      const height = popover.getBoundingClientRect().height;
      const left =
        bounds.right + 8 + width <= window.innerWidth
          ? bounds.right + 8
          : Math.max(8, bounds.left - width - 8);
      const top = Math.max(8, Math.min(bounds.bottom - height, window.innerHeight - height - 8));
      setPopoverPosition({ top, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [projectSwitcherOpen]);

  useEffect(() => {
    if (!projectSwitcherOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !switcherRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setProjectSwitcherOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [projectSwitcherOpen, setProjectSwitcherOpen]);

  return (
    <aside data-slot="global-navigation" className={`side ${sidebarCompact ? "msb" : ""}`}>
      <div className="brand">
        <button
          type="button"
          className="logo"
          title="Collapse or expand sidebar"
          aria-label="Collapse or expand sidebar"
          onClick={toggleSidebarCompact}
        >
          T
        </button>
        <span className="lbl">Task</span>
        <button
          type="button"
          className="ib sbc"
          title={sidebarCompact ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCompact ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebarCompact}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Workspace navigation">
        {globalNavigation.map(({ label, icon: Icon }) => (
          <Fragment key={label}>
            <button
              type="button"
              className={`nv ${section === label ? "on" : ""}`}
              title={label}
              aria-label={label}
              aria-current={section === label ? "page" : undefined}
              onClick={() => selectSection(label)}
            >
              <em className="ni">
                <Icon className="size-[18px]" />
              </em>
              <span>{label}</span>
              {label === "Tasks" && <i>{taskCount}</i>}
              {label === "Documents" && <i>{documentCount}</i>}
            </button>
            {label === "Tasks" && section === "Tasks" && (
              <div className="sub2">
                <button
                  type="button"
                  className={`nv ${taskGroupFilter ? "" : "on"}`}
                  onClick={() => selectTaskGroup("")}
                >
                  <span>All groups</span>
                  <i>{taskCount}</i>
                </button>
                {taskGroups.map((group) => (
                  <button
                    type="button"
                    key={group.id}
                    className={`nv ${taskGroupFilter === group.id ? "on" : ""}`}
                    onClick={() => selectTaskGroup(group.id)}
                  >
                    <span>{group.name}</span>
                    <i>{group.total}</i>
                  </button>
                ))}
              </div>
            )}
            {label === "Documents" && section === "Documents" && (
              <div className="sub2">
                <button
                  type="button"
                  className={`nv ${documentFolder ? "" : "on"}`}
                  onClick={() => selectDocumentFolder("")}
                >
                  <span>All files</span>
                  <i>{documentPaths.length}</i>
                </button>
                {topLevelFolders(documentPaths).map((folder) => (
                  <button
                    type="button"
                    key={folder.name}
                    className={`nv ${documentFolder === folder.name ? "on" : ""}`}
                    onClick={() => selectDocumentFolder(folder.name)}
                  >
                    <span>{folder.name}/</span>
                    <i>{folder.count}</i>
                  </button>
                ))}
                {rootDocuments.map((doc) => (
                  <button
                    type="button"
                    key={doc.id}
                    className={`nv ${activeDocumentId === doc.id ? "on" : ""}`}
                    title={doc.path}
                    onClick={() => openDocument(doc.id)}
                  >
                    <span>{doc.path}</span>
                  </button>
                ))}
              </div>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="shd">Workspace</div>
      <nav aria-label="Workspace tools">
        <button
          type="button"
          className={`nv ${section === "Agent prompts" ? "on" : ""}`}
          title="Agent prompts"
          aria-current={section === "Agent prompts" ? "page" : undefined}
          onClick={() => selectSection("Agent prompts")}
        >
          <em className="ni">
            <Sparkles className="size-[18px]" />
          </em>
          <span>Agent prompts</span>
        </button>
      </nav>
      <div className="gap" />
      <div className="pj">
        <div ref={switcherRef} className="relative w-full" data-slot="project-switcher">
          <button
            type="button"
            onClick={() => setProjectSwitcherOpen((open) => !open)}
            className="proj"
            title={`Project switcher: ${workspace?.projectName ?? "no project selected"}`}
            aria-label={`Project switcher: ${workspace?.projectName ?? "no project selected"}`}
            aria-haspopup="dialog"
            aria-expanded={projectSwitcherOpen}
          >
            {activeProject ? (
              <ProjectIcon project={activeProject} />
            ) : (
              <span className="grid size-[32px] shrink-0 place-items-center rounded-[9px] bg-accent text-primary">
                <Folder className="size-4" />
              </span>
            )}
            <div className="project-label min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold">
                {activeProject ? projectName(activeProject) : "Select project"}
              </span>
              <small className="block truncate">Switch project</small>
            </div>
            <span className="sr-only">Open project switcher</span>
          </button>
        </div>
      </div>
      {projectSwitcherOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            data-slot="project-switcher"
            role="dialog"
            aria-label="Trusted projects"
            style={{
              position: "fixed",
              top: popoverPosition?.top ?? 8,
              left: popoverPosition?.left ?? 64,
              visibility: popoverPosition ? "visible" : "hidden",
            }}
            className="z-[100] max-h-[calc(100dvh-1rem)] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10"
          >
            {workspace &&
              !trustedProjects.some((project) => project.path === workspace.projectRoot) && (
                <button
                  type="button"
                  onClick={() => void trustProjectPath(workspace.projectRoot)}
                  className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2.5 text-left hover:bg-accent/60"
                >
                  <FolderKanban className="size-4" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    Add {workspace.projectName} to your projects
                  </span>
                </button>
              )}
            <ProjectList
              projects={trustedProjects}
              onProjects={setTrustedProjects}
              switchProject={switchProject}
              removeProjectTrust={removeProjectTrust}
              trustProjectPath={trustProjectPath}
              onNotice={setNotice}
              onNavigate={() => setProjectSwitcherOpen(false)}
            />
          </div>,
          document.body,
        )}
    </aside>
  );
}
