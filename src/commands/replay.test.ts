import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replayCommand } from "./replay.ts";
import { initCommand } from "./init.ts";
import { gitAdd, gitCommit } from "../git/operations.ts";
import type { Config } from "../config/schema.ts";

let dir: string;
let snapshotDir: string;
let specDir: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "urlwatcher-replay-"));
  snapshotDir = join(dir, "snapshot");
  specDir = join(dir, "targets");
  await initCommand(snapshotDir, specDir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function config(overrides: Partial<Config> = {}): Config {
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
    onChange: "printf test",
    ...overrides,
  };
}

async function writeSpec(alias: string, body: string, extraFrontMatter = ""): Promise<void> {
  const frontMatter = ["url: https://example.com/" + alias, extraFrontMatter]
    .filter((line) => line !== "")
    .join("\n");
  const lines = ["---", frontMatter, "---", "", body].join("\n");
  await Bun.write(join(specDir, `${alias}.md`), lines + "\n");
}

async function commitSnapshot(file: string, content: string, message: string): Promise<void> {
  await Bun.write(join(snapshotDir, file), content);
  await gitAdd(snapshotDir, [file]);
  await gitCommit(snapshotDir, message);
}

describe("replayCommand", () => {
  test("returns the newest historical textual diff for an alias", async () => {
    await writeSpec("blog", "Use this body");
    await commitSnapshot("blog.md", "first\n", "first snapshot");
    await commitSnapshot("blog.md", "second\n", "second snapshot");

    const contexts = await replayCommand(config(), "blog");

    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.alias).toBe("blog");
    expect(contexts[0]!.body).toBe("Use this body\n");
    expect(contexts[0]!.url).toBe("https://example.com/blog");
    expect(contexts[0]!.diff).toContain("[-first-");
    expect(contexts[0]!.diff).toContain("{+second+");
  });

  test("falls back past a rename-only commit to the newest real diff", async () => {
    await writeSpec("feed", "Replay body");
    await commitSnapshot("feed.md", "same\n", "initial snapshot");

    const oldPath = join(snapshotDir, "feed.md");
    const newPath = join(snapshotDir, "feed.yaml");
    await Bun.write(newPath, readFileSync(oldPath, "utf8"));
    rmSync(oldPath);
    await gitAdd(snapshotDir, ["feed.md", "feed.yaml"]);
    await gitCommit(snapshotDir, "rename snapshot");

    await commitSnapshot("feed.yaml", "changed\n", "changed snapshot");

    const contexts = await replayCommand(config(), "feed");

    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.diff).toContain("[-same-");
    expect(contexts[0]!.diff).toContain("{+changed+");
  });

  test("skips disabled aliases and leaves snapshot state untouched", async () => {
    await writeSpec("quiet", "Body", "enabled: false");
    await commitSnapshot("quiet.md", "hello\n", "quiet snapshot");
    const statePath = join(snapshotDir, ".state.yaml");
    const before = existsSync(statePath) ? readFileSync(statePath, "utf8") : undefined;

    const contexts = await replayCommand(config());

    expect(contexts).toEqual([]);
    const after = existsSync(statePath) ? readFileSync(statePath, "utf8") : undefined;
    expect(after).toBe(before);
  });

  test("returns empty when no historical diff exists for the alias", async () => {
    await writeSpec("empty", "Body");

    const contexts = await replayCommand(config(), "empty");

    expect(contexts).toEqual([]);
  });
});
