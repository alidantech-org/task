"use client";

import { Folder } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { isArchivedTask } from "@/lib/overview";

export function GroupsPage() {
  const { groups, allTasks, setTaskGroupFilter } = useWorkspaceApp();
  const router = useRouter();

  function openGroup(groupId: string) {
    setTaskGroupFilter(groupId);
    router.push("/tasks");
  }

  return (
    <div>
      <header className="head">
        <div>
          <p className="sub">Task groups in this project.</p>
          <h1>Groups</h1>
        </div>
      </header>
      <div className="stats">
        {groups.map((group) => {
          const relatedTasks = allTasks.filter(
            (task) =>
              task.type === "task" &&
              !isArchivedTask(task) &&
              (task.path === group.path || task.path.startsWith(`${group.path}/`)),
          );
          const taskCount = relatedTasks.length;
          const completedCount = relatedTasks.filter((task) => task.status === "completed").length;
          const percent = taskCount ? Math.round((completedCount / taskCount) * 100) : 0;
          return (
            <button
              type="button"
              className="stat"
              key={group.id}
              onClick={() => openGroup(group.id)}
            >
              <p>
                <Folder className="size-4 shrink-0" />
                {group.name}
              </p>
              <strong>{percent}%</strong>
              <div className="bar">
                <b style={{ width: `${percent}%` }} />
              </div>
              <small className="sub">
                {completedCount} of {taskCount} complete
              </small>
            </button>
          );
        })}
        {groups.length === 0 && <p className="sub">No groups yet.</p>}
      </div>
    </div>
  );
}
