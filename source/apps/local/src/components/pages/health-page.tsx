"use client";

import { Button, Card, CardContent, Input } from "@task/ui";
import { useEffect, useState } from "react";
import { useWorkspaceApp } from "@/components/layout/app-layout";
import { CustomSelect } from "@/components/ui/select";

function archiveDelayLabel(value: number | null | undefined): string {
  return value === null ? "off" : String(value ?? 2);
}

export function HealthPage() {
  const { workspace, connectionStatus, refresh, validate, migrate, setNotice } = useWorkspaceApp();
  const [weekStart, setWeekStart] = useState(String(workspace?.organization?.weekStart ?? 1));
  const [archiveDelay, setArchiveDelay] = useState(
    archiveDelayLabel(workspace?.organization?.autoArchiveAfterDays),
  );
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setWeekStart(String(workspace?.organization?.weekStart ?? 1));
    setArchiveDelay(archiveDelayLabel(workspace?.organization?.autoArchiveAfterDays));
  }, [workspace?.organization?.weekStart, workspace?.organization?.autoArchiveAfterDays]);
  async function saveSettings() {
    setSaving(true);
    try {
      const response = await fetch("/api/runtime/workspace/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weekStart: Number(weekStart),
          autoArchiveAfterDays: archiveDelay === "off" ? null : Number(archiveDelay),
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Could not save workspace settings");
      await refresh();
      setNotice("Workspace settings saved");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save workspace settings");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <header>
        <p className="text-sm text-muted-foreground">Workspace settings and diagnostics.</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Workspace health</h1>
      </header>
      <Card className="mt-6 rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <p>
            Runtime: <strong>{connectionStatus}</strong>
          </p>
          <p>
            Project: <code className="text-xs">{workspace?.projectRoot ?? "Not selected"}</code>
          </p>
          <p>
            Managed directory:{" "}
            <code className="text-xs">{workspace?.workspaceDirectory ?? "—"}</code>
          </p>
          <p>Last snapshot: {workspace ? new Date(workspace.scannedAt).toLocaleString() : "—"}</p>
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div className="text-sm">
              <span>Week starts on</span>
              <CustomSelect
                label="Week starts on"
                value={weekStart}
                onValueChange={setWeekStart}
                className="mt-1.5"
                options={[
                  { value: "1", label: "Monday (ISO default)" },
                  ...[2, 3, 4, 5, 6, 7].map((day) => ({
                    value: String(day),
                    label:
                      ["", "", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
                        day
                      ] ?? "",
                  })),
                ]}
              />
            </div>
            <div className="text-sm">
              <label htmlFor="archive-delay">Auto-archive resolved groups after</label>
              <Input
                id="archive-delay"
                value={archiveDelay}
                onChange={(event) => setArchiveDelay(event.target.value)}
                placeholder="2 days or off"
                className="mt-1.5"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Enter a number of days or “off”.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveSettings()} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
            <Button variant="outline" onClick={() => void refresh()}>
              Refresh index
            </Button>
            <Button variant="outline" onClick={() => void validate()}>
              Validate
            </Button>
            <Button variant="outline" onClick={() => void migrate()}>
              Organize legacy groups
            </Button>
          </div>
          {workspace?.diagnostics.map((item) => (
            <p key={`${item.path}:${item.message}`} className="text-sm text-amber-700">
              {item.path}: {item.message}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
