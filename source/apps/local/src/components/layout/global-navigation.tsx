"use client";
import {
  Calendar,
  Code2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  File,
  Folder,
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
  LocalProjectIcon,
  ProjectList,
  projectName,
  type SwitcherProject,
} from "@/components/layout/project-switcher";
import { TaskcodeMark } from "@/components/layout/taskcode-mark";
import { directChildFolders } from "@/lib/markdown";

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
  { label: "Waves", icon: Folder },
  { label: "Documents", icon: File },
  { label: "Code", icon: Code2 },
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
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

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
      // The project dialogs are portalled outside the popover DOM. Keep their
      // owning ProjectList mounted while the user interacts with the dialog;
      // otherwise the first pointerdown on the overlay closes the popover and
      // unmounts the dialog before its click handlers can run.
      if (projectDialogOpen) return;
      const target = event.target;
      if (
        target instanceof Node &&
        !switcherRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        if (
          target instanceof Element &&
          target.closest('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')
        ) {
          return;
        }
        setProjectSwitcherOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [projectDialogOpen, projectSwitcherOpen, setProjectSwitcherOpen]);

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
          <TaskcodeMark className="taskcode-sidebar-mark" />
        </button>
        <span className="lbl taskcode-wordmark">
          <span>Task</span>
          <span>code</span>
        </span>
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
      <nav className="main-navigation" aria-label="Workspace navigation">
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
                  <span>All waves</span>
                  <i>{taskCount}</i>
                </button>
                {taskGroups.slice(0, 4).map((group) => (
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
                {taskGroups.length > 4 && (
                  <button
                    type="button"
                    className="nv sub-more"
                    onClick={() => selectSection("Waves")}
                  >
                    <span>View all waves…</span>
                  </button>
                )}
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
                {directChildFolders(documentPaths, documentFolder)
                  .slice(0, 4)
                  .map((folder) => (
                    <button
                      type="button"
                      key={folder.name}
                      className="nv"
                      onClick={() => selectDocumentFolder(folder.path)}
                    >
                      <span title={folder.path}>{folder.name}/</span>
                      <i>{folder.count}</i>
                    </button>
                  ))}
                {rootDocuments
                  .slice(
                    0,
                    Math.max(0, 4 - directChildFolders(documentPaths, documentFolder).length),
                  )
                  .map((doc) => (
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
                {directChildFolders(documentPaths, documentFolder).length + rootDocuments.length >
                  4 && (
                  <button
                    type="button"
                    className="nv sub-more"
                    onClick={() => selectDocumentFolder("")}
                  >
                    <span>Browse all documents…</span>
                  </button>
                )}
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
          title="Prompts"
          aria-current={section === "Agent prompts" ? "page" : undefined}
          onClick={() => selectSection("Agent prompts")}
        >
          <em className="ni">
            <Sparkles className="size-[18px]" />
          </em>
          <span>Prompts</span>
        </button>
      </nav>
      <div className="gap" />
      <div className="pj">
        <div ref={switcherRef} className="relative w-full" data-slot="project-switcher">
          <button
            type="button"
            onClick={() => setProjectSwitcherOpen((open) => !open)}
            className="proj"
            title={`Local project: ${workspace?.projectName ?? "Select a project"} · Switch project`}
            aria-label={`Local project: ${workspace?.projectName ?? "Select a project"} · Switch project`}
            aria-haspopup="dialog"
            aria-expanded={projectSwitcherOpen}
          >
            <Folder className="project-switcher-folder" aria-hidden="true" />
            <span className="project-label min-w-0 flex-1 truncate text-left">
              {activeProject ? projectName(activeProject) : "Select project"}
            </span>
            {projectSwitcherOpen ? (
              <ChevronUp className="project-chevron size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="project-chevron size-4" aria-hidden="true" />
            )}
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
              visibility: projectDialogOpen ? "hidden" : popoverPosition ? "visible" : "hidden",
              pointerEvents: projectDialogOpen ? "none" : "auto",
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
                  <LocalProjectIcon size={22} />
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
              onNotice={setNotice}
              onNavigate={() => setProjectSwitcherOpen(false)}
              onDialogOpenChange={setProjectDialogOpen}
            />
          </div>,
          document.body,
        )}
    </aside>
  );
}
