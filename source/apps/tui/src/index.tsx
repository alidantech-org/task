import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import type { DocumentSummary, TaskGroup, WorkspaceContext } from "@task/workspace";
import {
  getDocument,
  listDocuments,
  listTaskGroups,
  listTasks,
  readWorkspaceIndex,
  resolveWorkspace,
} from "@task/workspace";
import { useEffect, useMemo, useState } from "react";
import {
  filterByQuery,
  filterGroups,
  getLaneTasks,
  getTaskGroup,
  sliceAroundSelection,
  taskLanes,
} from "#/model";
import type { NavigationSection } from "#/navigation";
import { clampIndex, navigationSections, wrapIndex } from "#/navigation";

type WorkspaceData = {
  context: WorkspaceContext;
  tasks: DocumentSummary[];
  documents: DocumentSummary[];
  groups: TaskGroup[];
};

async function loadWorkspace(): Promise<WorkspaceData> {
  const resolved = await resolveWorkspace({
    workspaceOverride: process.env.TASK_WORKSPACE_ROOT,
    environmentWorkspaceRoot: process.env.TASK_WORKSPACE_ROOT,
  });
  const context = { root: resolved.root, projectRoot: resolved.projectRoot };
  const index = await readWorkspaceIndex(context);
  return {
    context,
    tasks: listTasks(index, { archived: false }),
    documents: listDocuments(index),
    groups: await listTaskGroups(context),
  };
}

function TaskCard({ task, selected }: { task: DocumentSummary; selected: boolean }) {
  return (
    <box
      style={{
        flexDirection: "column",
        border: true,
        borderColor: selected ? "#38BDF8" : "#334155",
        backgroundColor: selected ? "#10263A" : "#0B1220",
        paddingX: 1,
        paddingY: 0,
      }}
    >
      <text fg={selected ? "#7DD3FC" : "#E2E8F0"}>
        {selected ? "› " : "  "}
        {task.metadata.name}
      </text>
      <text fg="#94A3B8">
        {task.metadata.id} · {task.metadata.priority ?? "medium"}
        {task.metadata.assignee ? ` · ${task.metadata.assignee}` : ""}
      </text>
    </box>
  );
}

function TaskDetails({
  task,
  groups,
}: {
  task: DocumentSummary | undefined;
  groups: readonly TaskGroup[];
}) {
  if (!task) {
    return <text fg="#94A3B8">No task selected. Create tasks with the `task` CLI.</text>;
  }
  const group = getTaskGroup(task, groups);
  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text fg="#F8FAFC">{task.metadata.name}</text>
      <text fg="#7DD3FC">{task.metadata.id}</text>
      <text fg="#FBBF24">{(task.metadata.status ?? "planned").toUpperCase()}</text>
      <text fg="#CBD5E1">Priority {task.metadata.priority ?? "medium"}</text>
      <text fg="#CBD5E1">Group {group?.name ?? "Ungrouped"}</text>
      {task.metadata.assignee ? <text fg="#CBD5E1">Assignee {task.metadata.assignee}</text> : null}
      {task.metadata.project ? <text fg="#CBD5E1">Project {task.metadata.project}</text> : null}
      {task.metadata.due_at ? <text fg="#CBD5E1">Due {task.metadata.due_at}</text> : null}
      {task.metadata.tags.length ? (
        <text fg="#94A3B8">Tags {task.metadata.tags.join(" · ")}</text>
      ) : null}
      <text fg="#64748B">{task.path}</text>
      <text fg="#64748B">Read-only here · use task update to change fields</text>
    </box>
  );
}

function DocumentDetails({
  context,
  document,
}: {
  context: WorkspaceContext;
  document: DocumentSummary | undefined;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    if (!document) {
      setBody("");
      return () => {
        active = false;
      };
    }
    setLoading(true);
    void getDocument(context, document.metadata.id)
      .then((result) => {
        if (active) setBody(result.body);
      })
      .catch((error: unknown) => {
        if (active)
          setBody(
            error instanceof Error
              ? `Preview unavailable: ${error.message}`
              : "Preview unavailable",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [context, document]);
  if (!document) return <text fg="#94A3B8">No document selected.</text>;
  const preview = body.split("\n").filter(Boolean).slice(0, 10).join("\n");
  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text fg="#F8FAFC">{document.metadata.name}</text>
      <text fg="#7DD3FC">
        {document.metadata.id} · {document.metadata.type}
      </text>
      <text fg="#64748B">{document.path}</text>
      {document.metadata.tags.length ? (
        <text fg="#94A3B8">Tags {document.metadata.tags.join(" · ")}</text>
      ) : null}
      <text fg="#CBD5E1">{loading ? "Loading preview…" : preview || "No body content."}</text>
      <text fg="#64748B">Read-only preview · edit through task docs open</text>
    </box>
  );
}

function WorkspaceTui({
  data,
  error,
}: {
  data: WorkspaceData | undefined;
  error: string | undefined;
}) {
  const [workspaceData, setWorkspaceData] = useState(data);
  const [workspaceError, setWorkspaceError] = useState(error);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const renderer = useRenderer();
  const dimensions = useTerminalDimensions();
  const section: NavigationSection = navigationSections[sectionIndex] ?? "Tasks";
  const visibleTasks = useMemo(
    () => filterByQuery(workspaceData?.tasks ?? [], query),
    [workspaceData, query],
  );
  const visibleDocuments = useMemo(
    () => filterByQuery(workspaceData?.documents ?? [], query),
    [workspaceData, query],
  );
  const visibleGroups = useMemo(
    () => filterGroups(workspaceData?.groups ?? [], query),
    [workspaceData, query],
  );
  const selectedTask = visibleTasks[clampIndex(selectedIndex, visibleTasks.length)];
  const selectedDocument = visibleDocuments[clampIndex(selectedIndex, visibleDocuments.length)];
  const selectedGroup = visibleGroups[clampIndex(selectedIndex, visibleGroups.length)];
  const wide = dimensions.width >= 120;

  useEffect(() => {
    setSelectedIndex((current) =>
      clampIndex(
        current,
        section === "Tasks"
          ? visibleTasks.length
          : section === "Groups"
            ? visibleGroups.length
            : section === "Docs"
              ? visibleDocuments.length
              : 0,
      ),
    );
  }, [section, visibleTasks.length, visibleGroups.length, visibleDocuments.length]);

  useKeyboard((key) => {
    if (showHelp && (key.name === "escape" || key.name === "?")) {
      setShowHelp(false);
      return;
    }
    if (searchMode) {
      if (key.name === "escape" || key.name === "enter") {
        setSearchMode(false);
        return;
      }
      if (key.name === "backspace") {
        setQuery((value) => value.slice(0, -1));
        setSelectedIndex(0);
        return;
      }
      if (key.name === "space") {
        setQuery((value) => `${value} `);
        setSelectedIndex(0);
        return;
      }
      if (!key.ctrl && !key.meta && key.name.length === 1) {
        setQuery((value) => value + key.name);
        setSelectedIndex(0);
      }
      return;
    }
    if (key.name === "escape") {
      renderer.destroy();
      return;
    }
    if (key.name === "q") {
      renderer.destroy();
      return;
    }
    if (key.name === "r") {
      void loadWorkspace()
        .then((next) => {
          setWorkspaceData(next);
          setWorkspaceError(undefined);
        })
        .catch((reason: unknown) => {
          setWorkspaceData(undefined);
          setWorkspaceError(reason instanceof Error ? reason.message : String(reason));
        });
      return;
    }
    if (key.name === "?" || (key.name === "/" && key.shift)) {
      setShowHelp((visible) => !visible);
      return;
    }
    if (key.name === "/") {
      setSearchMode(true);
      setQuery("");
      return;
    }
    if (key.name === "left" || key.name === "h") {
      setSectionIndex((current) => wrapIndex(current - 1, navigationSections.length));
      setSelectedIndex(0);
      return;
    }
    if (key.name === "right" || key.name === "l" || key.name === "tab") {
      setSectionIndex((current) => wrapIndex(current + 1, navigationSections.length));
      setSelectedIndex(0);
      return;
    }
    if (key.name === "up" || key.name === "k") {
      setSelectedIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (key.name === "down" || key.name === "j") {
      const length =
        section === "Tasks"
          ? visibleTasks.length
          : section === "Groups"
            ? visibleGroups.length
            : section === "Docs"
              ? visibleDocuments.length
              : 0;
      setSelectedIndex((current) => Math.min(Math.max(0, length - 1), current + 1));
    }
  });

  const tasksView = (
    <box style={{ flexDirection: "column", flexGrow: 1, gap: 1 }}>
      {query || searchMode ? (
        <text fg="#7DD3FC">
          Search {query}
          {searchMode ? "▏" : ""}
        </text>
      ) : null}
      <box style={{ flexDirection: wide ? "row" : "column", flexGrow: 1, gap: 1 }}>
        {wide ? (
          <box style={{ flexDirection: "row", flexGrow: 1, gap: 1 }}>
            {taskLanes.map((lane) => {
              const laneTasks = getLaneTasks(visibleTasks, lane);
              const selectedLaneIndex = laneTasks.findIndex(
                (task) => task.metadata.id === selectedTask?.metadata.id,
              );
              return (
                <box
                  key={lane}
                  title={`${lane.toUpperCase()} · ${laneTasks.length}`}
                  style={{
                    flexDirection: "column",
                    flexGrow: 1,
                    border: true,
                    borderColor: "#334155",
                    paddingX: 1,
                    paddingY: 1,
                    gap: 1,
                  }}
                >
                  {sliceAroundSelection(laneTasks, Math.max(0, selectedLaneIndex), 8).map(
                    (task) => {
                      const index = visibleTasks.findIndex(
                        (item) => item.metadata.id === task.metadata.id,
                      );
                      return (
                        <TaskCard
                          key={task.metadata.id}
                          task={task}
                          selected={index === selectedIndex}
                        />
                      );
                    },
                  )}
                  {!laneTasks.length ? <text fg="#475569">—</text> : null}
                </box>
              );
            })}
          </box>
        ) : (
          <box
            title={`TASKS · ${visibleTasks.length}`}
            style={{
              flexDirection: "column",
              flexGrow: 1,
              border: true,
              borderColor: "#334155",
              padding: 1,
              gap: 1,
            }}
          >
            {visibleTasks.length ? (
              sliceAroundSelection(visibleTasks, selectedIndex, 14).map((task) => {
                const index = visibleTasks.findIndex(
                  (item) => item.metadata.id === task.metadata.id,
                );
                return (
                  <TaskCard key={task.metadata.id} task={task} selected={index === selectedIndex} />
                );
              })
            ) : (
              <text fg="#94A3B8">No matching tasks. Use task create to add one.</text>
            )}
          </box>
        )}
        <box
          title="DETAILS"
          style={{
            width: wide ? 34 : "100%",
            border: true,
            borderColor: "#334155",
            flexDirection: "column",
            padding: 1,
            gap: 1,
          }}
        >
          <TaskDetails task={selectedTask} groups={workspaceData?.groups ?? []} />
        </box>
      </box>
    </box>
  );

  const groupsView = (
    <box style={{ flexDirection: "row", flexGrow: 1, gap: 1 }}>
      <box
        title={`GROUPS · ${visibleGroups.length}`}
        style={{
          width: wide ? 44 : "50%",
          flexDirection: "column",
          border: true,
          borderColor: "#334155",
          padding: 1,
          gap: 1,
        }}
      >
        {visibleGroups.length ? (
          sliceAroundSelection(visibleGroups, selectedIndex, 18).map((group) => {
            const index = visibleGroups.findIndex((item) => item.id === group.id);
            return (
              <text key={group.id} fg={selectedIndex === index ? "#7DD3FC" : "#CBD5E1"}>
                {selectedIndex === index ? "› " : "  "}
                {group.name} · {group.completed}/{group.total}
                {group.archived ? " · archived" : ""}
              </text>
            );
          })
        ) : (
          <text fg="#94A3B8">No groups found. Create one with task group create.</text>
        )}
      </box>
      <box
        title="GROUP DETAILS"
        style={{
          flexGrow: 1,
          border: true,
          borderColor: "#334155",
          flexDirection: "column",
          padding: 1,
          gap: 1,
        }}
      >
        {selectedGroup ? (
          <>
            <text fg="#F8FAFC">{selectedGroup.name}</text>
            <text fg="#7DD3FC">{selectedGroup.id}</text>
            <text fg="#CBD5E1">
              {selectedGroup.archived ? "Archived" : "Active"} · {selectedGroup.completed}/
              {selectedGroup.total} complete
            </text>
            <text fg="#64748B">{selectedGroup.path}</text>
          </>
        ) : (
          <text fg="#94A3B8">No group selected.</text>
        )}
      </box>
    </box>
  );

  const docsView = (
    <box style={{ flexDirection: "row", flexGrow: 1, gap: 1 }}>
      <box
        title={`DOCUMENTS · ${visibleDocuments.length}`}
        style={{
          width: wide ? 44 : "50%",
          flexDirection: "column",
          border: true,
          borderColor: "#334155",
          padding: 1,
          gap: 1,
        }}
      >
        {visibleDocuments.length ? (
          sliceAroundSelection(visibleDocuments, selectedIndex, 18).map((document) => {
            const index = visibleDocuments.findIndex(
              (item) => item.metadata.id === document.metadata.id,
            );
            return (
              <text key={document.metadata.id} fg={selectedIndex === index ? "#7DD3FC" : "#CBD5E1"}>
                {selectedIndex === index ? "› " : "  "}
                {document.metadata.name}
              </text>
            );
          })
        ) : (
          <text fg="#94A3B8">No documents found.</text>
        )}
      </box>
      <box
        title="PREVIEW"
        style={{
          flexGrow: 1,
          border: true,
          borderColor: "#334155",
          flexDirection: "column",
          padding: 1,
          gap: 1,
        }}
      >
        {workspaceData ? (
          <DocumentDetails context={workspaceData.context} document={selectedDocument} />
        ) : (
          <text fg="#94A3B8">Workspace unavailable.</text>
        )}
      </box>
    </box>
  );

  const view =
    section === "Tasks" ? (
      tasksView
    ) : section === "Groups" ? (
      groupsView
    ) : section === "Docs" ? (
      docsView
    ) : (
      <box
        title={section.toUpperCase()}
        style={{
          flexGrow: 1,
          border: true,
          borderColor: "#334155",
          flexDirection: "column",
          padding: 2,
          gap: 1,
        }}
      >
        <text fg="#F8FAFC">{section} is planned.</text>
        <text fg="#94A3B8">
          This section will appear when Task has a shared data source and supported operations for
          it.
        </text>
      </box>
    );

  return (
    <box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 1,
        gap: 1,
        backgroundColor: "#080D16",
      }}
    >
      <box style={{ flexDirection: "row", justifyContent: "space-between", paddingX: 1 }}>
        <text fg="#7DD3FC"> TASK </text>
        <text fg={workspaceError ? "#F87171" : "#34D399"}>
          {workspaceError ? "● DISCONNECTED" : "● CONNECTED"}
        </text>
        <text fg="#94A3B8">{workspaceData?.context.root ?? "No workspace"}</text>
      </box>
      <box style={{ flexDirection: wide ? "row" : "column", flexGrow: 1, gap: 1 }}>
        <box
          title="NAVIGATE"
          style={{
            width: wide ? 20 : "100%",
            height: wide ? "100%" : 3,
            border: true,
            borderColor: "#334155",
            flexDirection: wide ? "column" : "row",
            paddingX: 1,
            paddingY: 1,
            gap: 1,
          }}
        >
          {navigationSections.map((item, index) => (
            <box
              key={item}
              style={{
                backgroundColor: sectionIndex === index ? "#123047" : undefined,
                paddingX: 1,
              }}
            >
              <text fg={sectionIndex === index ? "#7DD3FC" : "#CBD5E1"}>
                {sectionIndex === index ? "› " : "  "}
                {item}
              </text>
            </box>
          ))}
        </box>
        {workspaceError ? (
          <box
            title="WORKSPACE UNAVAILABLE"
            style={{
              flexGrow: 1,
              border: true,
              borderColor: "#7F1D1D",
              flexDirection: "column",
              padding: 2,
              gap: 1,
            }}
          >
            <text fg="#FCA5A5">{workspaceError}</text>
            <text fg="#CBD5E1">
              Use task init in a new project, or pass --workspace &lt;path&gt;.
            </text>
          </box>
        ) : (
          view
        )}
      </box>
      {showHelp ? (
        <box style={{ border: true, borderColor: "#38BDF8", paddingX: 1 }}>
          <text fg="#E2E8F0">
            ? Help · ←/→ Sections · ↑/↓ Select · / Search · r Refresh · q Quit
          </text>
        </box>
      ) : null}
      <box style={{ flexDirection: "row", justifyContent: "space-between", paddingX: 1 }}>
        <text fg="#64748B">←/→ Sections · ↑/↓ Select · / Search · r Refresh · ? Help</text>
        <text fg="#64748B">q Quit · Read only</text>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
let data: WorkspaceData | undefined;
let loadError: string | undefined;
try {
  data = await loadWorkspace();
} catch (error) {
  loadError = error instanceof Error ? error.message : String(error);
}
createRoot(renderer).render(<WorkspaceTui data={data} error={loadError} />);
await renderer.closed;
