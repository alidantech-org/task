"use client";

import { CheckCircle2, Folder, LayoutGrid, List, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { CustomSelect } from "@/components/ui/select";
import { isArchivedTask } from "@/lib/overview";

type GroupFilter = "all" | "active" | "complete" | "empty";
type GroupSort = "name" | "progress" | "tasks";
type GroupDisplay = "cards" | "list";

export function GroupsPage() {
  const { groups, allTasks, setTaskGroupFilter } = useWorkspaceApp();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GroupFilter>("active");
  const [sort, setSort] = useState<GroupSort>("tasks");
  const [display, setDisplay] = useState<GroupDisplay>("cards");

  const summaries = useMemo(
    () =>
      groups.map((group) => {
        const tasks = allTasks.filter(
          (task) =>
            task.type === "task" &&
            !isArchivedTask(task) &&
            (task.path === group.path || task.path.startsWith(`${group.path}/`)),
        );
        const completed = tasks.filter((task) => task.status === "completed").length;
        const total = tasks.length;
        return {
          ...group,
          total,
          completed,
          remaining: total - completed,
          percent: total ? Math.round((completed / total) * 100) : 0,
        };
      }),
    [groups, allTasks],
  );

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return summaries
      .filter(
        (group) => !normalizedQuery || group.name.toLocaleLowerCase().includes(normalizedQuery),
      )
      .filter((group) => {
        if (filter === "active") return group.total > 0 && group.completed < group.total;
        if (filter === "complete") return group.total > 0 && group.completed === group.total;
        if (filter === "empty") return group.total === 0;
        return true;
      })
      .sort((left, right) => {
        if (sort === "progress") {
          return right.percent - left.percent || left.name.localeCompare(right.name);
        }
        if (sort === "tasks") {
          return right.total - left.total || left.name.localeCompare(right.name);
        }
        return left.name.localeCompare(right.name);
      });
  }, [summaries, query, filter, sort]);

  const activeCount = summaries.filter(
    (group) => group.total > 0 && group.completed < group.total,
  ).length;
  const completedCount = summaries.filter(
    (group) => group.total > 0 && group.completed === group.total,
  ).length;

  function openGroup(groupId: string) {
    setTaskGroupFilter(groupId);
    router.push("/tasks");
  }

  return (
    <div className="groups-page">
      <header className="head groups-page-head">
        <div>
          <p className="sub">
            {activeCount} active · {completedCount} complete
          </p>
          <h1>Waves</h1>
        </div>
        <fieldset className="seg groups-display" aria-label="Wave presentation">
          <button
            type="button"
            className={display === "cards" ? "on" : ""}
            onClick={() => setDisplay("cards")}
          >
            <LayoutGrid aria-hidden="true" /> Cards
          </button>
          <button
            type="button"
            className={display === "list" ? "on" : ""}
            onClick={() => setDisplay("list")}
          >
            <List aria-hidden="true" /> List
          </button>
        </fieldset>
      </header>

      <div className="groups-toolbar">
        <label className="groups-search">
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search waves"
            aria-label="Search waves"
          />
        </label>
        <fieldset className="groups-filter" aria-label="Filter waves">
          {(["all", "active", "complete", "empty"] as const).map((value) => (
            <button
              type="button"
              key={value}
              className={filter === value ? "on" : ""}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "All"
                : value === "complete"
                  ? "Complete"
                  : value[0]?.toLocaleUpperCase() + value.slice(1)}
            </button>
          ))}
        </fieldset>
        <CustomSelect
          label="Sort waves"
          value={sort}
          className="groups-sort"
          onValueChange={(value) => setSort(value as GroupSort)}
          options={[
            { value: "tasks", label: "Most tasks" },
            { value: "progress", label: "Most progress" },
            { value: "name", label: "Name" },
          ]}
        />
      </div>

      <div className={`group-results ${display === "list" ? "is-list" : "is-cards"}`}>
        {visible.map((group) => (
          <button
            type="button"
            className="group-result"
            key={group.id}
            onClick={() => openGroup(group.id)}
          >
            <span className="group-result-icon">
              {group.percent === 100 ? (
                <CheckCircle2 aria-hidden="true" />
              ) : (
                <Folder aria-hidden="true" />
              )}
            </span>
            <span className="group-result-copy">
              <b title={group.name}>{group.name}</b>
              <small>
                {group.total === 0
                  ? "No tasks"
                  : group.remaining === 0
                    ? "All tasks complete"
                    : `${group.remaining} remaining`}
              </small>
            </span>
            <span className="group-result-progress">
              <span>
                <b>{group.percent}%</b>
                <small>
                  {group.completed}/{group.total}
                </small>
              </span>
              <i>
                <span style={{ width: `${group.percent}%` }} />
              </i>
            </span>
          </button>
        ))}
        {visible.length === 0 && (
          <div className="groups-empty">
            <Folder aria-hidden="true" />
            <b>No matching waves</b>
            <span>Try another search or completion filter.</span>
          </div>
        )}
      </div>
    </div>
  );
}
