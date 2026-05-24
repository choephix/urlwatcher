import { describe, expect, test } from "bun:test";
import { extractDiffForPaths } from "./diff.ts";

const SAMPLE_DIFF = [
  "diff --git a/foo.md b/foo.md",
  "index 1111111..2222222 100644",
  "--- a/foo.md",
  "+++ b/foo.md",
  "@@ -1,1 +1,1 @@",
  "-foo old",
  "+foo new",
  "diff --git a/bar.md b/bar.md",
  "new file mode 100644",
  "index 0000000..3333333",
  "--- /dev/null",
  "+++ b/bar.md",
  "@@ -0,0 +1,2 @@",
  "+bar line one",
  "+bar line two",
  "\\ No newline at end of file",
  "diff --git a/baz.yaml b/baz.yaml",
  "similarity index 90%",
  "rename from baz.yaml",
  "rename to baz-renamed.yaml",
  "old mode 100644",
  "new mode 100755",
  "Binary files a/baz.yaml and b/baz.yaml differ",
].join("\n");

describe("extractDiffForPaths", () => {
  test("extracts only the requested file's hunks", () => {
    const out = extractDiffForPaths(SAMPLE_DIFF, ["bar.md"]);
    expect(out).toContain("@@ -0,0 +1,2 @@");
    expect(out).toContain("+bar line one");
    expect(out).toContain("+bar line two");
    expect(out).not.toContain("foo old");
    expect(out).not.toContain("foo new");
    expect(out).not.toContain("baz");
  });

  test("strips all metadata noise lines", () => {
    const out = extractDiffForPaths(SAMPLE_DIFF, ["foo.md", "bar.md", "baz.yaml"]);
    expect(out).not.toContain("index 1111111");
    expect(out).not.toContain("--- a/foo.md");
    expect(out).not.toContain("+++ b/foo.md");
    expect(out).not.toContain("new file mode");
    expect(out).not.toContain("similarity index");
    expect(out).not.toContain("rename from");
    expect(out).not.toContain("rename to");
    expect(out).not.toContain("old mode");
    expect(out).not.toContain("new mode");
    expect(out).not.toContain("Binary files");
    expect(out).not.toContain("\\ No newline");
    expect(out).not.toContain("--- /dev/null");
  });

  test("returns empty string when no paths match", () => {
    expect(extractDiffForPaths(SAMPLE_DIFF, ["nope.md"])).toBe("");
  });

  test("returns empty string for empty input", () => {
    expect(extractDiffForPaths("", ["foo.md"])).toBe("");
  });

  test("matches both a-side and b-side paths (for renames)", () => {
    const renamedDiff = [
      "diff --git a/old.md b/new.md",
      "similarity index 80%",
      "rename from old.md",
      "rename to new.md",
      "@@ -1,1 +1,1 @@",
      "-old line",
      "+new line",
    ].join("\n");
    const fromA = extractDiffForPaths(renamedDiff, ["old.md"]);
    const fromB = extractDiffForPaths(renamedDiff, ["new.md"]);
    expect(fromA).toContain("+new line");
    expect(fromB).toContain("-old line");
  });

  test("preserves hunk content for multiple paths", () => {
    const out = extractDiffForPaths(SAMPLE_DIFF, ["foo.md", "bar.md"]);
    expect(out).toContain("-foo old");
    expect(out).toContain("+foo new");
    expect(out).toContain("+bar line one");
  });
});
