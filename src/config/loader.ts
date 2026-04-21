import { parse, stringify } from "yaml";
import { ConfigSchema, type Config } from "./schema.ts";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { promptText, type AskFn } from "../prompt.ts";

const CONFIG_FILENAME = "urlwatcher.yaml";
const DEFAULT_SNAPSHOT_DIR = "./snapshot";
const DEFAULT_SPEC_DIR = "./targets";
const DEFAULT_TIMEOUT_MS = 30000;

type RawConfig = {
  snapshotDir: string;
  specDir: string;
  onChange?: string;
  defaults: {
    htmlConverter: string;
    jsonConverter: string;
    rssConverter: string;
    timeout: number;
  };
  notifications: Array<{ type: string; path?: string }>;
};

function findConfigPath(explicitPath?: string): string | undefined {
  if (explicitPath) {
    return existsSync(explicitPath) ? resolve(explicitPath) : undefined;
  }

  const candidates = [
    resolve(process.cwd(), CONFIG_FILENAME),
    resolve(homedir(), ".config", "urlwatcher", CONFIG_FILENAME),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function resolveConfigPath(explicitPath?: string): string {
  const foundPath = findConfigPath(explicitPath);
  if (foundPath) return foundPath;

  const candidates = explicitPath
    ? [resolve(explicitPath)]
    : [
        resolve(process.cwd(), CONFIG_FILENAME),
        resolve(homedir(), ".config", "urlwatcher", CONFIG_FILENAME),
      ];

  throw new Error(
    `No ${CONFIG_FILENAME} found. Searched:\n${candidates.map((c) => `  - ${c}`).join("\n")}`
  );
}

async function promptPositiveInt(
  question: string,
  defaultValue: number,
  ask?: AskFn
): Promise<number> {
  while (true) {
    const answer = await promptText(question, String(defaultValue), ask);
    const value = Number(answer);
    if (Number.isInteger(value) && value > 0) return value;
    console.log("Please enter a positive integer.");
  }
}

async function buildInitConfig(ask?: AskFn): Promise<RawConfig> {
  const snapshotDir = await promptText("Snapshot directory", DEFAULT_SNAPSHOT_DIR, ask);
  const specDir = await promptText("Target spec directory", DEFAULT_SPEC_DIR, ask);
  const timeout = await promptPositiveInt("Default fetch timeout (ms)", DEFAULT_TIMEOUT_MS, ask);
  const onChange = await promptText("onChange command (optional)", "", ask);
  const fileLogPath = await promptText("File notification log path (optional)", "", ask);

  return ConfigSchema.parse({
    snapshotDir,
    specDir,
    ...(onChange === "" ? {} : { onChange }),
    defaults: {
      htmlConverter: "turndown",
      jsonConverter: "yaml",
      rssConverter: "rss",
      timeout,
    },
    notifications:
      fileLogPath === ""
        ? [{ type: "stdout" }]
        : [{ type: "stdout" }, { type: "file", path: fileLogPath }],
  });
}

async function createConfigForInit(configPath: string, ask?: AskFn): Promise<Config> {
  console.log(`No ${CONFIG_FILENAME} found. Creating one at: ${configPath}`);
  console.log("Press Enter to accept defaults.");

  const config = await buildInitConfig(ask);
  mkdirSync(dirname(configPath), { recursive: true });
  await Bun.write(configPath, stringify(config, { lineWidth: 120 }));
  console.log(`Created config file: ${configPath}`);

  return (await loadConfig(configPath)).config;
}

export async function ensureConfigForInit(
  explicitPath?: string,
  ask?: AskFn
): Promise<{ config: Config; configPath: string; created: boolean }> {
  const existingPath = findConfigPath(explicitPath);
  if (existingPath) {
    const loaded = await loadConfig(existingPath);
    return { ...loaded, created: false };
  }

  const configPath = explicitPath
    ? resolve(explicitPath)
    : resolve(process.cwd(), CONFIG_FILENAME);
  const config = await createConfigForInit(configPath, ask);
  return { config, configPath, created: true };
}

export async function loadConfig(explicitPath?: string): Promise<{ config: Config; configPath: string }> {
  const configPath = resolveConfigPath(explicitPath);
  const raw = await Bun.file(configPath).text();
  const parsed = parse(raw);
  const config = ConfigSchema.parse(parsed);
  const base = dirname(configPath);
  const resolved = {
    ...config,
    snapshotDir: resolve(base, config.snapshotDir),
    specDir: resolve(base, config.specDir),
    notifications: config.notifications.map((n) =>
      typeof n.path === "string" ? { ...n, path: resolve(base, n.path) } : n
    ),
  };
  return { config: resolved, configPath };
}

export { resolveConfigPath };
