import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCommand } from "./check.ts";
import { initCommand } from "./init.ts";
import { gitAdd, gitCommit, gitStatus } from "../git/operations.ts";
import type { Config } from "../config/schema.ts";

let dir: string;
let snapshotDir: string;
let specDir: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "urlwatcher-check-"));
  snapshotDir = join(dir, "snapshot");
  specDir = join(dir, "targets");
  await initCommand(snapshotDir, specDir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function config(): Config {
  return {
    snapshotDir,
    specDir,
    defaults: {
      htmlConverter: "turndown",
      jsonConverter: "yaml",
      rssConverter: "rss",
      timeout: 30000,
    },
    notifications: [{ type: "stdout" }],
  };
}

async function writeJsonSpec(alias: string): Promise<void> {
  await Bun.write(
    join(specDir, `${alias}.md`),
    [
      "---",
      "url: data:application/json,%7B%22value%22%3A2%7D",
      "contentType: json",
      "---",
      "",
    ].join("\n")
  );
}

async function commitStaleMarkdownSnapshot(alias: string): Promise<void> {
  await Bun.write(join(snapshotDir, `${alias}.md`), "old markdown\n");
  await gitAdd(snapshotDir, [`${alias}.md`]);
  await gitCommit(snapshotDir, "old markdown snapshot");
}

describe("checkCommand", () => {
  test("removes stale snapshot files when detected extension changes", async () => {
    await writeJsonSpec("api");
    await commitStaleMarkdownSnapshot("api");

    const results = await checkCommand(config(), "api");

    expect(results).toHaveLength(1);
    expect(results[0]!.changed).toBe(true);
    expect(results[0]!.extension).toBe("yaml");
    expect(results[0]!.staleSnapshotFiles).toEqual(["api.md"]);
    expect(existsSync(join(snapshotDir, "api.yaml"))).toBe(true);
    expect(existsSync(join(snapshotDir, "api.md"))).toBe(false);
    expect((await gitStatus(snapshotDir)).trim()).toBe("");
  });

  test("restores stale snapshot files after dry-run extension changes", async () => {
    await writeJsonSpec("api");
    await commitStaleMarkdownSnapshot("api");

    const results = await checkCommand(config(), "api", true);

    expect(results).toHaveLength(1);
    expect(results[0]!.changed).toBe(true);
    expect(results[0]!.extension).toBe("yaml");
    expect(results[0]!.staleSnapshotFiles).toEqual(["api.md"]);
    expect(existsSync(join(snapshotDir, "api.yaml"))).toBe(false);
    expect(existsSync(join(snapshotDir, "api.md"))).toBe(true);
    expect((await gitStatus(snapshotDir)).trim()).toBe("");
  });
});
