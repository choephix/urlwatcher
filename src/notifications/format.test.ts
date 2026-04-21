import { test, expect, describe } from "bun:test";
import { formatRunBlock } from "./format.ts";
import type { CheckResult } from "../types.ts";

const ts = new Date("2026-04-21T08:00:00");

function run(results: CheckResult[]) {
  return formatRunBlock({ timestamp: ts, results, dryRun: false });
}

describe("formatRunBlock", () => {
  test("renders timestamp header", () => {
    const out = run([{ alias: "a", url: "u", changed: false }]);
    expect(out).toContain("2026-04-21 08:00:00");
    expect(out).toContain("═".repeat(60));
  });

  test("packs consecutive no-change entries tight", () => {
    const out = run([
      { alias: "a", url: "u", changed: false },
      { alias: "b", url: "u", changed: false },
      { alias: "c", url: "u", changed: false },
    ]);
    expect(out).toContain("[a] no changes\n[b] no changes\n[c] no changes");
  });

  test("surrounds diff entries with blank lines", () => {
    const out = run([
      { alias: "a", url: "u", changed: false },
      { alias: "b", url: "u", changed: true, added: 1, removed: 1, diff: "{+added+}\n[-removed-]" },
      { alias: "c", url: "u", changed: false },
    ]);
    expect(out).toContain("[a] no changes\n\n[b] changed  +1 -1\n{+added+}\n[-removed-]\n\n[c] no changes");
  });

  test("renders stat from added/removed fields", () => {
    const out = run([{ alias: "x", url: "u", changed: true, added: 2, removed: 1, diff: "…" }]);
    expect(out).toContain("[x] changed  +2 -1");
  });

  test("omits zero counts from stat", () => {
    const out = run([{ alias: "x", url: "u", changed: true, added: 2, removed: 0, diff: "…" }]);
    expect(out).toContain("[x] changed  +2\n");
    expect(out).not.toContain("+2 -0");
  });

  test("omits stat entirely when counts missing (defensive)", () => {
    const out = run([{ alias: "x", url: "u", changed: true, diff: "…" }]);
    expect(out).toContain("[x] changed\n");
  });

  test("labels first snapshot as 'new snapshot'", () => {
    const out = run([
      { alias: "x", url: "u", changed: true, isNew: true, added: 1, removed: 0, diff: "{+first+}" },
    ]);
    expect(out).toContain("[x] new snapshot  +1");
  });

  test("renders errors on their own line", () => {
    const out = run([
      { alias: "x", url: "u", changed: false, error: "fetch failed: ETIMEDOUT" },
    ]);
    expect(out).toContain("[x] error  fetch failed: ETIMEDOUT");
  });

  test("ends with three blank lines between runs", () => {
    const out = run([{ alias: "a", url: "u", changed: false }]);
    // last content line = "[a] no changes", then 4 newlines => 3 blank lines before next block
    expect(out.endsWith("[a] no changes\n\n\n\n")).toBe(true);
  });

  test("two runs concatenate with exactly 3 blank lines between", () => {
    const a = run([{ alias: "a", url: "u", changed: false }]);
    const b = run([{ alias: "b", url: "u", changed: false }]);
    const combined = a + b;
    // between "[a] no changes" and the next "═..." header: 3 blank lines
    expect(combined).toContain("[a] no changes\n\n\n\n" + "═".repeat(60));
  });
});
