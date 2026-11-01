"use client";

import { Button } from "@task/ui";
import { ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { ProjectIcon } from "@/components/layout/project-switcher";

type Member = {
  path: string;
  name: string;
  icon?: string;
  color?: number;
  active?: boolean;
  error?: string;
  counts?: {
    planned: number;
    inProgress: number;
    blocked: number;
    completed: number;
    overdue: number;
    documents: number;
  };
  tasks?: { id: string; name: string; status?: string; priority?: string; due_at?: string }[];
};
type Summary = { id: string; name: string; icon?: string; members: Member[] };
type GroupRef = { id: string; name: string; icon?: string; paths: string[] };

/** One view over linked repositories; each keeps its own workspace, tasks and docs. */
export function ProjectsPage() {
  const { switchProject } = useWorkspaceApp();
  const params = useSearchParams();
  const groupId = params.get("group") ?? "";
  const [groups, setGroups] = useState<GroupRef[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setSummary(null);
    setError("");
    const load = async () => {
      try {
        const list = (await (
          await fetch("/api/runtime/projects/trusted", { cache: "no-store" })
        ).json()) as { groups?: GroupRef[] };
        if (!active) return;
        setGroups(list.groups ?? []);
        const id = groupId || list.groups?.[0]?.id;
        if (!id) return;
        const response = await fetch(
          `/api/runtime/projects/groups/${encodeURIComponent(id)}/summary`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as {
          group?: Summary;
          error?: { message?: string };
        };
        if (!response.ok || !payload.group)
          throw new Error(payload.error?.message ?? "Could not load the group");
        if (active) setSummary(payload.group);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [groupId]);

  if (error) return <p className="sub docs-empty">{error}</p>;
  if (groups.length === 0 && !summary)
    return (
      <p className="sub docs-empty">
        No linked projects yet. Open the project switcher, choose “Edit name, icon and group” on a
        project, and link it to a group.
      </p>
    );
  if (!summary) return <p className="sub docs-empty">Loading…</p>;
  const total = (pick: (counts: NonNullable<Member["counts"]>) => number) =>
    summary.members.reduce((sum, member) => sum + (member.counts ? pick(member.counts) : 0), 0);
  return (
    <div className="pg">
      <header className="docs-bar">
        <h1>
          {summary.icon ? `${summary.icon} ` : ""}
          {summary.name} <small>{summary.members.length} projects</small>
        </h1>
      </header>
      <div className="pg-totals">
        <span>
          <b>{total((c) => c.inProgress)}</b> in progress
        </span>
        <span>
          <b>{total((c) => c.planned)}</b> planned
        </span>
        <span>
          <b>{total((c) => c.blocked)}</b> blocked
        </span>
        <span>
          <b>{total((c) => c.overdue)}</b> overdue
        </span>
        <span>
          <b>{total((c) => c.completed)}</b> done
        </span>
      </div>
      <div className="pg-grid">
        {summary.members.map((member) => (
          <section className="pg-card" key={member.path}>
            <header>
              <ProjectIcon project={member} />
              <b title={member.path}>{member.name}</b>
              <Button
                size="sm"
                variant="outline"
                disabled={member.active}
                onClick={() => void switchProject(member.path)}
              >
                {member.active ? "Open now" : "Open"} <ArrowRight className="size-4" />
              </Button>
            </header>
            {member.error ? (
              <p className="sub">{member.error}</p>
            ) : (
              <>
                <div className="dchips">
                  <span className="dchip">{member.counts?.inProgress} in progress</span>
                  <span className="dchip">{member.counts?.planned} planned</span>
                  <span className="dchip">{member.counts?.documents} docs</span>
                  {member.counts?.overdue ? (
                    <span className="dchip">{member.counts.overdue} overdue</span>
                  ) : null}
                </div>
                <ul>
                  {member.tasks?.map((task) => (
                    <li key={task.id}>
                      <span>{task.name}</span>
                      <small>{task.due_at ?? task.status}</small>
                    </li>
                  ))}
                  {member.tasks?.length === 0 && <li className="sub">Nothing open.</li>}
                </ul>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
