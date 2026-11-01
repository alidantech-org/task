import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { isOneOf, readStored, writeStored } from "@/lib/persistent-state";

const store = new Map<string, string>();
const original = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  store.clear();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  };
});
afterEach(() => {
  (globalThis as { window?: unknown }).window = original;
});

describe("stored view state", () => {
  const isView = isOneOf(["Board", "List"] as const);

  test("round trips valid values", () => {
    writeStored("view", "List");
    expect(readStored("view", "Board", isView)).toBe("List");
  });

  test("ignores invalid, corrupt or missing values", () => {
    expect(readStored("missing", "Board", isView)).toBe("Board");
    store.set("view", JSON.stringify("Calendar"));
    expect(readStored("view", "Board", isView)).toBe("Board");
    store.set("view", "{not json");
    expect(readStored("view", "Board", isView)).toBe("Board");
  });

  test("survives a throwing storage", () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    };
    expect(readStored("view", "Board", isView)).toBe("Board");
    expect(() => writeStored("view", "List")).not.toThrow();
  });
});
