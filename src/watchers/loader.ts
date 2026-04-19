import { readdirSync, existsSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { parse } from "yaml";
import { WatcherFrontMatterSchema, type Watcher } from "../config/schema.ts";

const ALIAS_RE = /^[a-zA-Z0-9\-_]+$/;

export function parseWatcherFile(raw: string, filePath: string): Watcher {
  const alias = basename(filePath, extname(filePath));
  if (!ALIAS_RE.test(alias)) {
    throw new Error(
      `Watcher filename "${basename(filePath)}" is not a valid alias (alphanumeric, hyphens, underscores only)`
    );
  }

  const { frontMatter, body } = splitFrontMatter(raw, filePath);
  const fmRaw = parse(frontMatter) ?? {};
  const fm = WatcherFrontMatterSchema.parse(fmRaw);

  return { ...fm, alias, body, filePath };
}

function splitFrontMatter(
  raw: string,
  filePath: string
): { frontMatter: string; body: string } {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) {
    throw new Error(`Watcher "${filePath}" missing YAML front matter (must start with "---")`);
  }
  const after = normalized.slice(3);
  const end = after.search(/\n---\s*(\r?\n|$)/);
  if (end === -1) {
    throw new Error(`Watcher "${filePath}" has unterminated front matter`);
  }
  const frontMatter = after.slice(0, end).replace(/^\r?\n/, "");
  const bodyStart = end + after.slice(end).match(/\n---\s*(\r?\n|$)/)![0].length;
  const body = after.slice(bodyStart).replace(/^\r?\n/, "");
  return { frontMatter, body };
}

export async function loadWatchers(watchDir: string): Promise<Watcher[]> {
  if (!existsSync(watchDir)) return [];
  const entries = readdirSync(watchDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const watchers: Watcher[] = [];
  for (const entry of entries) {
    const filePath = resolve(watchDir, entry);
    const raw = await Bun.file(filePath).text();
    watchers.push(parseWatcherFile(raw, filePath));
  }

  const seen = new Set<string>();
  for (const w of watchers) {
    if (seen.has(w.alias)) {
      throw new Error(`Duplicate watcher alias "${w.alias}"`);
    }
    seen.add(w.alias);
  }
  return watchers;
}

export async function loadWatcher(
  watchDir: string,
  alias: string
): Promise<Watcher | undefined> {
  const all = await loadWatchers(watchDir);
  return all.find((w) => w.alias === alias);
}
