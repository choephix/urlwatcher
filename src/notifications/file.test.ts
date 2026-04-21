import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fileNotifier from "./file.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "urlwatcher-file-notifier-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const ts = new Date("2026-04-21T08:00:00");

describe("file notifier", () => {
  test("appends a formatted run block to the configured path", async () => {
    const path = join(dir, "runs.log");
    await fileNotifier.notifyRun(
      { timestamp: ts, dryRun: false, results: [{ alias: "a", url: "u", changed: false }] },
      { type: "file", path }
    );
    const contents = readFileSync(path, "utf8");
    expect(contents).toContain("2026-04-21 08:00:00");
    expect(contents).toContain("[a] no changes");
  });

  test("appends (not overwrites) on repeated calls", async () => {
    const path = join(dir, "runs.log");
    for (const alias of ["a", "b", "c"]) {
      await fileNotifier.notifyRun(
        { timestamp: ts, dryRun: false, results: [{ alias, url: "u", changed: false }] },
        { type: "file", path }
      );
    }
    const contents = readFileSync(path, "utf8");
    expect(contents.match(/═/g)!.length).toBe(60 * 2 * 3); // 3 runs × 2 rulers × 60 chars
    expect(contents).toContain("[a] no changes");
    expect(contents).toContain("[b] no changes");
    expect(contents).toContain("[c] no changes");
  });

  test("creates parent directories if missing", async () => {
    const path = join(dir, "nested", "deeper", "runs.log");
    await fileNotifier.notifyRun(
      { timestamp: ts, dryRun: false, results: [{ alias: "a", url: "u", changed: false }] },
      { type: "file", path }
    );
    expect(existsSync(path)).toBe(true);
  });

  test("skips writing on dry-run", async () => {
    const path = join(dir, "runs.log");
    await fileNotifier.notifyRun(
      { timestamp: ts, dryRun: true, results: [{ alias: "a", url: "u", changed: false }] },
      { type: "file", path }
    );
    expect(existsSync(path)).toBe(false);
  });

  test("throws a clear error when path is missing", async () => {
    await expect(
      fileNotifier.notifyRun(
        { timestamp: ts, dryRun: false, results: [{ alias: "a", url: "u", changed: false }] },
        { type: "file" }
      )
    ).rejects.toThrow(/path/);
  });
});
