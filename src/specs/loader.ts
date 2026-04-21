import { readdirSync, existsSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { parse } from "yaml";
import { SpecFrontMatterSchema, type TargetSpec } from "../config/schema.ts";

const ALIAS_RE = /^[a-zA-Z0-9\-_]+$/;

export function parseSpecFile(raw: string, filePath: string): TargetSpec {
  const alias = basename(filePath, extname(filePath));
  if (!ALIAS_RE.test(alias)) {
    throw new Error(
      `Target spec filename "${basename(filePath)}" is not a valid alias (alphanumeric, hyphens, underscores only)`
    );
  }

  const { frontMatter, body } = splitFrontMatter(raw, filePath);
  const fmRaw = parse(frontMatter) ?? {};
  const fm = SpecFrontMatterSchema.parse(fmRaw);

  return { ...fm, alias, body, filePath };
}

function splitFrontMatter(
  raw: string,
  filePath: string
): { frontMatter: string; body: string } {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) {
    throw new Error(`Target spec "${filePath}" missing YAML front matter (must start with "---")`);
  }
  const after = normalized.slice(3);
  const end = after.search(/\n---\s*(\r?\n|$)/);
  if (end === -1) {
    throw new Error(`Target spec "${filePath}" has unterminated front matter`);
  }
  const frontMatter = after.slice(0, end).replace(/^\r?\n/, "");
  const bodyStart = end + after.slice(end).match(/\n---\s*(\r?\n|$)/)![0].length;
  const body = after.slice(bodyStart).replace(/^\r?\n/, "");
  return { frontMatter, body };
}

export async function loadSpecs(specDir: string): Promise<TargetSpec[]> {
  if (!existsSync(specDir)) return [];
  const entries = readdirSync(specDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const specs: TargetSpec[] = [];
  for (const entry of entries) {
    const filePath = resolve(specDir, entry);
    const raw = await Bun.file(filePath).text();
    specs.push(parseSpecFile(raw, filePath));
  }

  const seen = new Set<string>();
  for (const w of specs) {
    if (seen.has(w.alias)) {
      throw new Error(`Duplicate target alias "${w.alias}"`);
    }
    seen.add(w.alias);
  }
  return specs;
}

export async function loadSpec(
  specDir: string,
  alias: string
): Promise<TargetSpec | undefined> {
  const all = await loadSpecs(specDir);
  return all.find((w) => w.alias === alias);
}
