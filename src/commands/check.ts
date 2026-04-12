import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { Config, UrlEntry } from "../config/schema.ts";
import type { CheckResult } from "../types.ts";
import { fetchUrl, detectContentType } from "../fetcher.ts";
import { getConverter } from "../converters/registry.ts";
import { loadState, saveState } from "../state.ts";
import {
  isGitRepo,
  isClean,
  gitAdd,
  gitDiffCached,
  gitDiffCachedStat,
  gitResetHead,
  gitCommit,
  gitRestoreFiles,
  gitCleanFiles,
} from "../git/operations.ts";

// Ensure all converters are registered
import "../converters/yaml-converter.ts";
import "../converters/turndown.ts";
import "../converters/jina.ts";

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
    throw new Error(
      `Data directory has uncommitted changes: ${dataDir}\nPlease commit or discard them before running check.`
    );
  }

  const urls = alias
    ? config.urls.filter((u) => u.alias === alias)
    : config.urls;

  if (alias && urls.length === 0) {
    throw new Error(`No tracked URL with alias "${alias}"`);
  }

  if (urls.length === 0) {
    console.log("No URLs to check. Add some with: urlwatcher add <url>");
    return [];
  }

  const results: CheckResult[] = [];
  const writtenFiles: string[] = [];

  for (const entry of urls) {
    const result = await processUrl(entry, config, dataDir);
    results.push(result);
    if (!result.error) {
      writtenFiles.push(result.alias);
    }
  }

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

  // Stage all written files
  const filenames = writtenFiles.map((a) => {
    const r = results.find((r) => r.alias === a)!;
    return `${a}.${r.extension}`;
  });
  await gitAdd(dataDir, filenames);

  // Check for actual data changes
  const stat = await gitDiffCachedStat(dataDir);
  if (!stat.trim()) {
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

  // Get the full diff
  const fullDiff = await gitDiffCached(dataDir);

  // Parse which files changed from the stat output
  const changedFiles = new Set(
    stat
      .split("\n")
      .filter((line) => line.includes("|"))
      .map((line) => line.trim().split(/\s+/)[0]!)
  );

  // Update results with change info
  for (const r of results) {
    if (r.error) continue;
    const filename = `${r.alias}.${r.extension}`;
    r.changed = changedFiles.has(filename);
  }

  // Attach diff to changed results
  for (const r of results) {
    if (r.changed) {
      r.diff = extractFileDiff(fullDiff, r.alias);
    }
  }

  if (dryRun) {
    await gitResetHead(dataDir);
    // Restore existing files to their previous state, delete new ones
    const existingFiles = results.filter((r) => !r.isNew && !r.error).map((r) => `${r.alias}.${r.extension}`);
    const newFiles = results.filter((r) => r.isNew && !r.error).map((r) => `${r.alias}.${r.extension}`);
    await gitRestoreFiles(dataDir, existingFiles);
    await gitCleanFiles(dataDir, newFiles);
  } else {
    // Update state
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

async function processUrl(
  entry: UrlEntry,
  config: Config,
  dataDir: string
): Promise<CheckResult> {
  const result: CheckResult = {
    alias: entry.alias,
    url: entry.url,
    changed: false,
  };

  try {
    const timeout = entry.timeout ?? config.defaults.timeout;
    const type = entry.contentType;

    // Check if this is a first-time fetch
    const ext = type === "json" ? "yaml" : "md";
    const filePath = resolve(dataDir, `${entry.alias}.${ext}`);
    result.isNew = !existsSync(filePath);

    let converterName: string;
    let body = "";
    let contentType = "";

    if (type === "json") {
      converterName = entry.jsonConverter ?? config.defaults.jsonConverter;
    } else {
      converterName = entry.htmlConverter ?? config.defaults.htmlConverter;
    }

    const converter = getConverter(converterName);

    if (!converter.handlesOwnFetching) {
      const fetched = await fetchUrl(entry.url, timeout);
      if (!fetched.ok) {
        console.warn(`  ⚠ ${entry.alias}: ${fetched.error}`);
        result.error = fetched.error;
        return result;
      }
      body = fetched.body;
      contentType = fetched.contentType;

      // Re-detect content type from actual response if not forced
      if (!type) {
        const detected = detectContentType(contentType);
        if (detected === "json") {
          converterName = entry.jsonConverter ?? config.defaults.jsonConverter;
          const jsonConverter = getConverter(converterName);
          const converted = await jsonConverter.convert(entry.url, body, contentType, { timeout });
          const outPath = resolve(dataDir, `${entry.alias}.${converted.extension}`);
          result.isNew = !existsSync(outPath);
          await Bun.write(outPath, converted.content);
          result.extension = converted.extension;
          return result;
        }
      }
    }

    const converted = await converter.convert(entry.url, body, contentType, { timeout });
    await Bun.write(filePath, converted.content);
    result.extension = converted.extension;

    return result;
  } catch (err: any) {
    console.warn(`  ⚠ ${entry.alias}: ${err.message}`);
    result.error = err.message;
    return result;
  }
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
    // Strip git metadata lines
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
