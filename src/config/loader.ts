import { parse } from "yaml";
import { ConfigSchema, type Config } from "./schema.ts";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";

const CONFIG_FILENAME = "urlwatcher.yaml";

function resolveConfigPath(explicitPath?: string): string {
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw new Error(`Config file not found: ${explicitPath}`);
    }
    return resolve(explicitPath);
  }

  const candidates = [
    resolve(process.cwd(), CONFIG_FILENAME),
    resolve(homedir(), ".config", "urlwatcher", CONFIG_FILENAME),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `No ${CONFIG_FILENAME} found. Searched:\n${candidates.map((c) => `  - ${c}`).join("\n")}`
  );
}

export async function loadConfig(explicitPath?: string): Promise<{ config: Config; configPath: string }> {
  const configPath = resolveConfigPath(explicitPath);
  const raw = await Bun.file(configPath).text();
  const parsed = parse(raw);
  const config = ConfigSchema.parse(parsed);
  const base = dirname(configPath);
  const resolved = {
    ...config,
    dataDir: resolve(base, config.dataDir),
    watchDir: resolve(base, config.watchDir),
  };
  return { config: resolved, configPath };
}

export { resolveConfigPath };
