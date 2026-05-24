import { resolve } from "node:path";
import { existsSync, unlinkSync } from "node:fs";
import type { Config, TargetSpec } from "../config/schema.ts";
import type { CheckResult } from "../types.ts";
import { fetchUrl, detectContentType } from "../fetcher.ts";
import { getConverter } from "../converters/registry.ts";
import { loadState, saveState } from "../state.ts";
import { acquireLock } from "../lock.ts";
import { loadSpecs } from "../specs/loader.ts";
import {
  isGitRepo,
  isClean,
  gitAdd,
  gitAddAll,
  gitStatus,
  gitDiffCached,
  gitDiffCachedNumstat,
  gitResetHead,
  gitCommit,
  gitRestoreFiles,
  gitCleanFiles,
} from "../git/operations.ts";
import { confirm } from "../prompt.ts";
import { extractDiffForPaths } from "../diff.ts";

import "../converters/yaml-converter.ts";
import "../converters/turndown.ts";
import "../converters/jina.ts";
import "../converters/rss.ts";

export async function checkCommand(
  config: Config,
  alias?: string,
  dryRun = false
): Promise<CheckResult[]> {
  const snapshotDir = resolve(config.snapshotDir);

  if (!(await isGitRepo(snapshotDir))) {
    throw new Error(
      `Snapshot directory is not a git repo: ${snapshotDir}\nRun "urlwatcher init" first.`
    );
  }

  if (!(await isClean(snapshotDir))) {
    const status = await gitStatus(snapshotDir);
    console.log(`Snapshot directory has uncommitted changes: ${snapshotDir}`);
    console.log(status.trimEnd());
    const shouldCommit = await confirm('Commit them as "manual changes" and continue?', false);
    if (!shouldCommit) {
      throw new Error("Aborted. Please commit or discard the changes before running check.");
    }
    await gitAddAll(snapshotDir);
    await gitCommit(snapshotDir, "manual changes");
  }

  const releaseLock = acquireLock(snapshotDir);
  try {
    return await checkCommandLocked(config, snapshotDir, alias, dryRun);
  } finally {
    releaseLock();
  }
}

async function checkCommandLocked(
  config: Config,
  snapshotDir: string,
  alias?: string,
  dryRun = false
): Promise<CheckResult[]> {
  const allSpecs = await loadSpecs(config.specDir);
  const selected = alias
    ? allSpecs.filter((w) => w.alias === alias)
    : allSpecs;

  if (alias && selected.length === 0) {
    throw new Error(`No target spec with alias "${alias}" in ${config.specDir}`);
  }

  const specs = selected.filter((w) => w.enabled);
  const skipped = selected.filter((w) => !w.enabled).map((w) => w.alias);
  if (skipped.length > 0) {
    console.log(`Skipping disabled: ${skipped.join(", ")}`);
  }

  if (specs.length === 0) {
    if (selected.length === 0) {
      console.log(
        `No target specs to check. Add some with: urlwatcher add <url> --alias <name>`
      );
    }
    return [];
  }

  const results = await Promise.all(
    specs.map((w) => processSpec(w, config, snapshotDir))
  );
  const writtenFiles = results
    .filter((r) => !r.error)
    .map((r) => r.alias);

  const now = new Date().toISOString();

  if (writtenFiles.length === 0) {
    if (!dryRun) await commitStateOnly(snapshotDir, results, now);
    return results;
  }

  const filenames = writtenFiles.flatMap((a) => {
    const r = results.find((r) => r.alias === a)!;
    return [`${a}.${r.extension}`, ...(r.staleSnapshotFiles ?? [])];
  });
  await gitAdd(snapshotDir, filenames);

  const numstat = await gitDiffCachedNumstat(snapshotDir);
  if (numstat.size === 0) {
    await gitResetHead(snapshotDir);
    for (const r of results) {
      if (!r.error) r.changed = false;
    }
    if (!dryRun) {
      await commitStateOnly(snapshotDir, results, now);
    } else {
      await gitResetHead(snapshotDir);
      const existingFiles = restorableSnapshotFiles(results);
      const newFiles = results.filter((r) => r.isNew && !r.error).map((r) => `${r.alias}.${r.extension}`);
      await gitRestoreFiles(snapshotDir, existingFiles);
      await gitCleanFiles(snapshotDir, newFiles);
    }
    return results;
  }

  const changedFilenames = results
    .filter((r) => !r.error)
    .map((r) => `${r.alias}.${r.extension}`)
    .filter((filename) => numstat.has(filename));
  const fullDiff = await gitDiffCached(snapshotDir, changedFilenames);

  for (const r of results) {
    if (r.error) continue;
    const filename = `${r.alias}.${r.extension}`;
    const counts = numstat.get(filename);
    if (!counts) continue;
    r.changed = true;
    r.diff = extractDiffForPaths(fullDiff, [filename]);
    r.added = counts.added;
    r.removed = counts.removed;
  }

  if (dryRun) {
    await gitResetHead(snapshotDir);
    const existingFiles = restorableSnapshotFiles(results);
    const newFiles = results.filter((r) => r.isNew && !r.error).map((r) => `${r.alias}.${r.extension}`);
    await gitRestoreFiles(snapshotDir, existingFiles);
    await gitCleanFiles(snapshotDir, newFiles);
  } else {
    const state = await loadState(snapshotDir);
    for (const r of results) {
      if (!r.error) {
        state[r.alias] = { ...state[r.alias], lastChecked: now };
        if (r.changed) state[r.alias]!.lastChanged = now;
      }
    }
    await saveState(snapshotDir, state);
    await gitAdd(snapshotDir, [".state.yaml"]);

    const changedAliases = results.filter((r) => r.changed).map((r) => r.alias);
    const message = `urlwatcher: Update ${changedAliases.join(", ")} — ${now}`;
    await gitCommit(snapshotDir, message);
  }

  return results;
}

async function commitStateOnly(
  snapshotDir: string,
  results: CheckResult[],
  now: string
): Promise<void> {
  const state = await loadState(snapshotDir);
  for (const r of results) {
    if (!r.error) state[r.alias] = { ...state[r.alias], lastChecked: now };
  }
  await saveState(snapshotDir, state);
  await gitAdd(snapshotDir, [".state.yaml"]);
  try {
    await gitCommit(snapshotDir, `urlwatcher: Update state — ${now}`);
  } catch {
    await gitResetHead(snapshotDir);
  }
}

function restorableSnapshotFiles(results: CheckResult[]): string[] {
  return results
    .filter((r) => !r.error)
    .flatMap((r) => [
      ...(!r.isNew ? [`${r.alias}.${r.extension}`] : []),
      ...(r.staleSnapshotFiles ?? []),
    ]);
}

async function processSpec(
  spec: TargetSpec,
  config: Config,
  snapshotDir: string
): Promise<CheckResult> {
  const result: CheckResult = {
    alias: spec.alias,
    url: spec.url,
    changed: false,
    body: spec.body,
  };

  try {
    const timeout = spec.timeout ?? config.defaults.timeout;
    const type = spec.contentType;

    let converterName = pickConverter(type, spec, config);
    let converter = getConverter(converterName);
    let body = "";
    let contentType = "";

    if (!converter.handlesOwnFetching) {
      const fetched = await fetchUrl(spec.url, timeout);
      if (!fetched.ok) {
        console.warn(`  ⚠ ${spec.alias}: ${fetched.error}`);
        result.error = fetched.error;
        return result;
      }
      body = fetched.body;
      contentType = fetched.contentType;

      if (!type) {
        const detected = detectContentType(contentType, body);
        if (detected !== "html") {
          converterName = pickConverter(detected, spec, config);
          converter = getConverter(converterName);
        }
      }
    }

    const converted = await converter.convert(spec.url, body, contentType, { timeout });
    const outPath = resolve(snapshotDir, `${spec.alias}.${converted.extension}`);
    result.isNew = !existsSync(outPath);
    await Bun.write(outPath, converted.content);
    result.extension = converted.extension;
    result.staleSnapshotFiles = removeStaleSnapshotFiles(
      snapshotDir,
      spec.alias,
      converted.extension
    );

    return result;
  } catch (err: any) {
    console.warn(`  ⚠ ${spec.alias}: ${err.message}`);
    result.error = err.message;
    return result;
  }
}

function removeStaleSnapshotFiles(
  snapshotDir: string,
  alias: string,
  activeExtension: "md" | "yaml"
): string[] {
  const staleFiles: string[] = [];
  for (const extension of ["md", "yaml"] as const) {
    if (extension === activeExtension) continue;
    const filename = `${alias}.${extension}`;
    const path = resolve(snapshotDir, filename);
    if (!existsSync(path)) continue;
    unlinkSync(path);
    staleFiles.push(filename);
  }
  return staleFiles;
}

function pickConverter(
  type: "html" | "json" | "rss" | undefined,
  spec: TargetSpec,
  config: Config
): string {
  if (type === "json") return spec.jsonConverter ?? config.defaults.jsonConverter;
  if (type === "rss") return spec.rssConverter ?? config.defaults.rssConverter;
  return spec.htmlConverter ?? config.defaults.htmlConverter;
}
