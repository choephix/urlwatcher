import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { Config, Watcher } from "../config/schema.ts";
import type { CheckResult } from "../types.ts";
import { fetchUrl, detectContentType } from "../fetcher.ts";
import { getConverter } from "../converters/registry.ts";
import { loadState, saveState } from "../state.ts";
import { acquireLock } from "../lock.ts";
import { loadWatchers } from "../watchers/loader.ts";
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

import "../converters/yaml-converter.ts";
import "../converters/turndown.ts";
import "../converters/jina.ts";
import "../converters/rss.ts";

export async function checkCommand(
  config: Config,
  alias?: string,
  dryRun = false
): Promise<CheckResult[]> {
  const dataDir = resolve(config.dataDir);

  if (!(await isGitRepo(dataDir))) {
    throw new Error(
      `Data directory is not a git repo: ${dataDir}\nRun "urlwatcher init" first.`
    );
  }

  if (!(await isClean(dataDir))) {
    const status = await gitStatus(dataDir);
    console.log(`Data directory has uncommitted changes: ${dataDir}`);
    console.log(status.trimEnd());
    const shouldCommit = await confirm('Commit them as "manual changes" and continue?', false);
    if (!shouldCommit) {
      throw new Error("Aborted. Please commit or discard the changes before running check.");
    }
    await gitAddAll(dataDir);
    await gitCommit(dataDir, "manual changes");
  }

  const releaseLock = acquireLock(dataDir);
  try {
    return await checkCommandLocked(config, dataDir, alias, dryRun);
  } finally {
    releaseLock();
  }
}

async function checkCommandLocked(
  config: Config,
  dataDir: string,
  alias?: string,
  dryRun = false
): Promise<CheckResult[]> {
  const allWatchers = await loadWatchers(config.watchDir);
  const selected = alias
    ? allWatchers.filter((w) => w.alias === alias)
    : allWatchers;

  if (alias && selected.length === 0) {
    throw new Error(`No watcher with alias "${alias}" in ${config.watchDir}`);
  }

  const watchers = selected.filter((w) => w.enabled);
  const skipped = selected.filter((w) => !w.enabled).map((w) => w.alias);
  if (skipped.length > 0) {
    console.log(`Skipping disabled: ${skipped.join(", ")}`);
  }

  if (watchers.length === 0) {
    if (selected.length === 0) {
      console.log(
        `No watchers to check. Add some with: urlwatcher add <url> --alias <name>`
      );
    }
    return [];
  }

  const results = await Promise.all(
    watchers.map((w) => processWatcher(w, config, dataDir))
  );
  const writtenFiles = results
    .filter((r) => !r.error)
    .map((r) => r.alias);

  const now = new Date().toISOString();

  if (writtenFiles.length === 0) {
    if (!dryRun) {
      const state = await loadState(dataDir);
      for (const r of results) {
        if (!r.error) state[r.alias] = { ...state[r.alias], lastChecked: now };
      }
      await saveState(dataDir, state);
      await gitAdd(dataDir, [".state.yaml"]);
      await gitCommit(dataDir, `urlwatcher: Update state — ${now}`).catch(() => {
        gitResetHead(dataDir);
      });
    }
    return results;
  }

  const filenames = writtenFiles.map((a) => {
    const r = results.find((r) => r.alias === a)!;
    return `${a}.${r.extension}`;
  });
  await gitAdd(dataDir, filenames);

  const numstat = await gitDiffCachedNumstat(dataDir);
  if (numstat.size === 0) {
    await gitResetHead(dataDir);
    for (const r of results) {
      if (!r.error) r.changed = false;
    }
    if (!dryRun) {
      const state = await loadState(dataDir);
      for (const r of results) {
        if (!r.error) state[r.alias] = { ...state[r.alias], lastChecked: now };
      }
      await saveState(dataDir, state);
      await gitAdd(dataDir, [".state.yaml"]);
      await gitCommit(dataDir, `urlwatcher: Update state — ${now}`).catch(() => {
        gitResetHead(dataDir);
      });
    } else {
      await gitResetHead(dataDir);
      const existingFiles = results.filter((r) => !r.isNew && !r.error).map((r) => `${r.alias}.${r.extension}`);
      const newFiles = results.filter((r) => r.isNew && !r.error).map((r) => `${r.alias}.${r.extension}`);
      await gitRestoreFiles(dataDir, existingFiles);
      await gitCleanFiles(dataDir, newFiles);
    }
    return results;
  }

  const fullDiff = await gitDiffCached(dataDir);

  for (const r of results) {
    if (r.error) continue;
    const filename = `${r.alias}.${r.extension}`;
    const counts = numstat.get(filename);
    if (!counts) continue;
    r.changed = true;
    r.diff = extractFileDiff(fullDiff, r.alias);
    r.added = counts.added;
    r.removed = counts.removed;
  }

  if (dryRun) {
    await gitResetHead(dataDir);
    const existingFiles = results.filter((r) => !r.isNew && !r.error).map((r) => `${r.alias}.${r.extension}`);
    const newFiles = results.filter((r) => r.isNew && !r.error).map((r) => `${r.alias}.${r.extension}`);
    await gitRestoreFiles(dataDir, existingFiles);
    await gitCleanFiles(dataDir, newFiles);
  } else {
    const state = await loadState(dataDir);
    for (const r of results) {
      if (!r.error) {
        state[r.alias] = { ...state[r.alias], lastChecked: now };
        if (r.changed) state[r.alias]!.lastChanged = now;
      }
    }
    await saveState(dataDir, state);
    await gitAdd(dataDir, [".state.yaml"]);

    const changedAliases = results.filter((r) => r.changed).map((r) => r.alias);
    const message = `urlwatcher: Update ${changedAliases.join(", ")} — ${now}`;
    await gitCommit(dataDir, message);
  }

  return results;
}

async function processWatcher(
  watcher: Watcher,
  config: Config,
  dataDir: string
): Promise<CheckResult> {
  const result: CheckResult = {
    alias: watcher.alias,
    url: watcher.url,
    changed: false,
    body: watcher.body,
  };

  try {
    const timeout = watcher.timeout ?? config.defaults.timeout;
    const type = watcher.contentType;

    const initialExt = type === "html" || !type ? "md" : "yaml";
    const initialPath = resolve(dataDir, `${watcher.alias}.${initialExt}`);
    result.isNew = !existsSync(initialPath);

    let converterName = pickConverter(type, watcher, config);
    let converter = getConverter(converterName);
    let body = "";
    let contentType = "";

    if (!converter.handlesOwnFetching) {
      const fetched = await fetchUrl(watcher.url, timeout);
      if (!fetched.ok) {
        console.warn(`  ⚠ ${watcher.alias}: ${fetched.error}`);
        result.error = fetched.error;
        return result;
      }
      body = fetched.body;
      contentType = fetched.contentType;

      if (!type) {
        const detected = detectContentType(contentType, body);
        if (detected !== "html") {
          converterName = pickConverter(detected, watcher, config);
          converter = getConverter(converterName);
        }
      }
    }

    const converted = await converter.convert(watcher.url, body, contentType, { timeout });
    const outPath = resolve(dataDir, `${watcher.alias}.${converted.extension}`);
    result.isNew = !existsSync(outPath);
    await Bun.write(outPath, converted.content);
    result.extension = converted.extension;

    return result;
  } catch (err: any) {
    console.warn(`  ⚠ ${watcher.alias}: ${err.message}`);
    result.error = err.message;
    return result;
  }
}

function pickConverter(
  type: "html" | "json" | "rss" | undefined,
  watcher: Watcher,
  config: Config
): string {
  if (type === "json") return watcher.jsonConverter ?? config.defaults.jsonConverter;
  if (type === "rss") return watcher.rssConverter ?? config.defaults.rssConverter;
  return watcher.htmlConverter ?? config.defaults.htmlConverter;
}

function extractFileDiff(fullDiff: string, alias: string): string {
  const lines = fullDiff.split("\n");
  const chunks: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      capturing = line.includes(`/${alias}.`);
      continue;
    }
    if (!capturing) continue;
    if (
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("new file mode") ||
      line.startsWith("\\ No newline")
    ) continue;
    chunks.push(line);
  }

  return chunks.join("\n").trim();
}
