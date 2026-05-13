import { mkdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { stringify } from "yaml";
import type { SpecFrontMatterInput } from "../config/schema.ts";

const ALIAS_RE = /^[a-zA-Z0-9\-_]+$/;

export function specPath(specDir: string, alias: string): string {
  return resolve(specDir, `${alias}.md`);
}

export async function createSpecFile(
  specDir: string,
  alias: string,
  frontMatter: SpecFrontMatterInput,
  body = ""
): Promise<string> {
  if (!ALIAS_RE.test(alias)) {
    throw new Error("Alias must be alphanumeric with hyphens/underscores");
  }
  if (!existsSync(specDir)) {
    mkdirSync(specDir, { recursive: true });
  }
  const path = specPath(specDir, alias);
  if (existsSync(path)) {
    throw new Error(`Target spec "${alias}" already exists at ${path}`);
  }

  const fmYaml = stringify(stripUndefined(frontMatter), { lineWidth: 120 }).trimEnd();
  const content = `---\n${fmYaml}\n---\n${body ? body.replace(/^\n+/, "") : ""}`;
  await Bun.write(path, content);
  return path;
}

export function deleteSpecFile(specDir: string, alias: string): boolean {
  const path = specPath(specDir, alias);
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
