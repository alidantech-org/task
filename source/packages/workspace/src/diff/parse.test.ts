import { describe, expect, test } from "bun:test";
import { parseUnifiedDiff } from "#/diff/parse";

describe("parseUnifiedDiff", () => {
  test("numbers added, deleted and context lines across hunks", () => {
    const [file] = parseUnifiedDiff(
      [
        "diff --git a/src/a.ts b/src/a.ts",
        "index 1..2 100644",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -1,3 +1,4 @@",
        " one",
        "-two",
        "+TWO",
        "+three",
        " four",
        "\\ No newline at end of file",
      ].join("\n"),
    );
    expect(file?.newPath).toBe("src/a.ts");
    expect(file?.hunks[0]?.lines.map((line) => [line.type, line.oldLine, line.newLine])).toEqual([
      ["context", 1, 1],
      ["delete", 2, undefined],
      ["add", undefined, 2],
      ["add", undefined, 3],
      ["context", 3, 4],
    ]);
  });

  test("handles renames and binary files", () => {
    const files = parseUnifiedDiff(
      "diff --git a/a.png b/b.png\nsimilarity index 90%\nrename from a.png\nrename to b.png\nBinary files a/a.png and b/b.png differ\n",
    );
    expect(files[0]).toMatchObject({ oldPath: "a.png", newPath: "b.png", binary: true });
  });
});
