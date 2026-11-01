"use client";

import { useCallback, useEffect, useState } from "react";

export function readStored<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Remembering the view is a convenience; the page works without storage.
  }
}

/**
 * State remembered in `localStorage`. The first render uses `initial` so server and client markup
 * agree; the stored value is applied after mount. Invalid stored values are ignored.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Restore once on mount.
  useEffect(() => {
    setValue(readStored(key, initial, validate));
  }, [key]);
  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeStored(key, next);
    },
    [key],
  );
  return [value, update];
}

export const isOneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === "string" && (allowed as readonly string[]).includes(value);

export const isStringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

export const isString = (value: unknown): value is string => typeof value === "string";
export const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
