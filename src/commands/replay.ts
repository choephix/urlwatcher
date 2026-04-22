import { resolve } from "node:path";
import type { Config, TargetSpec } from "../config/schema.ts";
import type { OnChangeContext } from "../onchange.ts";
import { loadSpecs } from "../specs/loader.ts";
import { acquireLock } from "../lock.ts";
import { extractDiffForPaths } from "../diff.ts";
import { gitLogForPaths, gitShowDiffForPaths, isGitRepo } from "../git/operations.ts";

export interface ReplayContext extends OnChangeContext {
  commit: string;
}

export async function replayCommand(config: Config, alias?: string): Promise<ReplayContext[]> {
  const snapshotDir = resolve(config.snapshotDir);

  if (!(await isGitRepo(snapshotDir))) {
    throw new Error(
      `Snapshot directory is not a git repo: ${snapshotDir}\nRun "urlwatcher init" first.`
    );
  }

  const releaseLock = acquireLock(snapshotDir);
  try {
    return await replayCommandLocked(config, snapshotDir, alias);
  } finally {
    releaseLock();
  }
}

async function replayCommandLocked(
  config: Config,
  snapshotDir: string,
  alias?: string
): Promise<ReplayContext[]> {
  const allSpecs = await loadSpecs(config.specDir);
  const selected = alias ? allSpecs.filter((spec) => spec.alias === alias) : allSpecs;

  if (alias && selected.length === 0) {
    throw new Error(`No target spec with alias "${alias}" in ${config.specDir}`);
  }

  const specs = selected.filter((spec) => spec.enabled);
  const skipped = selected.filter((spec) => !spec.enabled).map((spec) => spec.alias);
  if (skipped.length > 0) {
    console.log(`Skipping disabled: ${skipped.join(", ")}`);
  }

  if (specs.length === 0) {
    if (selected.length === 0) {
      console.log(`No target specs to replay. Add some with: urlwatcher add <url> --alias <name>`);
    }
    return [];
  }

  const contexts = await Promise.all(specs.map((spec) => loadReplayContext(spec, snapshotDir)));
  const replayable = contexts.filter((ctx): ctx is ReplayContext => ctx !== undefined);

  if (replayable.length === 0) {
    console.log("No historical diffs found to replay.");
  }

  return replayable;
}

async function loadReplayContext(
  spec: TargetSpec,
  snapshotDir: string
): Promise<ReplayContext | undefined> {
  const snapshotPaths = [`${spec.alias}.md`, `${spec.alias}.yaml`];
  const commits = await gitLogForPaths(snapshotDir, snapshotPaths);

  for (const commit of commits) {
    const fullDiff = await gitShowDiffForPaths(snapshotDir, commit, snapshotPaths);
    const diff = extractDiffForPaths(fullDiff, snapshotPaths);
    if (!diff) continue;
    return {
      alias: spec.alias,
      url: spec.url,
      body: spec.body,
      diff,
      commit,
    };
  }

  console.log(`No historical diff found for ${spec.alias}.`);
  return undefined;
}
