import { WorkspaceError } from "@task/workspace/errors";
import type { QualityConfig, TrackingConfig } from "@task/workspace/indexing/types";

function mapping(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new WorkspaceError("invalid_workspace_config", `task.yaml ${label} must be a mapping`);
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0)
    throw new WorkspaceError(
      "invalid_workspace_config",
      `task.yaml ${label} must be a non-negative integer`,
    );
  return Number(value);
}

export function parseQualityConfig(value: unknown): QualityConfig {
  const options = mapping(value, "quality");
  const allowed = ["mode", "minTaskWords", "minChecklistItems", "minGroupDocWords"];
  if (Object.keys(options).some((key) => !allowed.includes(key)))
    throw new WorkspaceError(
      "invalid_workspace_config",
      "Unsupported quality setting in task.yaml",
    );
  if (options.mode !== undefined && !["reject", "warn", "off"].includes(String(options.mode)))
    throw new WorkspaceError(
      "invalid_workspace_config",
      "task.yaml quality.mode must be reject, warn or off",
    );
  return {
    ...(options.mode === undefined ? {} : { mode: options.mode as QualityConfig["mode"] }),
    ...(options.minTaskWords === undefined
      ? {}
      : { minTaskWords: positiveInteger(options.minTaskWords, "quality.minTaskWords") }),
    ...(options.minChecklistItems === undefined
      ? {}
      : {
          minChecklistItems: positiveInteger(
            options.minChecklistItems,
            "quality.minChecklistItems",
          ),
        }),
    ...(options.minGroupDocWords === undefined
      ? {}
      : {
          minGroupDocWords: positiveInteger(options.minGroupDocWords, "quality.minGroupDocWords"),
        }),
  };
}

export function parseTrackingConfig(value: unknown): TrackingConfig {
  const options = mapping(value, "tracking");
  if (Object.keys(options).some((key) => key !== "enabled"))
    throw new WorkspaceError(
      "invalid_workspace_config",
      "Unsupported tracking setting in task.yaml",
    );
  if (options.enabled !== undefined && typeof options.enabled !== "boolean")
    throw new WorkspaceError(
      "invalid_workspace_config",
      "task.yaml tracking.enabled must be a boolean",
    );
  return options.enabled === undefined ? {} : { enabled: options.enabled };
}

/** YAML lines for the policy sections, so rewriting task.yaml never drops them. */
export function policyYamlLines(config: {
  quality?: QualityConfig;
  tracking?: TrackingConfig;
}): string[] {
  const lines: string[] = [];
  if (config.quality && Object.keys(config.quality).length > 0) {
    lines.push("quality:");
    for (const [key, value] of Object.entries(config.quality)) lines.push(`  ${key}: ${value}`);
  }
  if (config.tracking && Object.keys(config.tracking).length > 0) {
    lines.push("tracking:");
    for (const [key, value] of Object.entries(config.tracking)) lines.push(`  ${key}: ${value}`);
  }
  return lines;
}
