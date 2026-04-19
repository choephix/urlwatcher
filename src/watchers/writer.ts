import { mkdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "yaml";
import type { WatcherFrontMatter } from "../config/schema.ts";

const ALIAS_RE = /^[a-zA-Z0-9\-_]+$/;

export function watcherPath(watchDir: string, alias: string): string {
  return resolve(watchDir, `${alias}.md`);
}

export async function createWatcherFile(
  watchDir: string,
  alias: string,
  frontMatter: WatcherFrontMatter,
  body = ""
): Promise<string> {
  if (!ALIAS_RE.test(alias)) {
    throw new Error("Alias must be alphanumeric with hyphens/underscores");
  }
  if (!existsSync(watchDir)) {
    mkdirSync(watchDir, { recursive: true });
  }
  const path = watcherPath(watchDir, alias);
  if (existsSync(path)) {
    throw new Error(`Watcher "${alias}" already exists at ${path}`);
  }

  const fmYaml = stringify(stripUndefined(frontMatter), { lineWidth: 120 }).trimEnd();
  const content = `---\n${fmYaml}\n---\n${body ? body.replace(/^\n+/, "") : ""}`;
  await Bun.write(path, content);
  return path;
}

export function deleteWatcherFile(watchDir: string, alias: string): boolean {
  const path = watcherPath(watchDir, alias);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as any)[k] = v;
  }
  return out;
}
