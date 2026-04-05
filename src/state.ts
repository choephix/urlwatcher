import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { parse, stringify } from "yaml";

const STATE_FILENAME = ".state.yaml";

export interface UrlState {
  lastChecked: string;
  lastChanged?: string;
}

export type State = Record<string, UrlState>;

export async function loadState(dataDir: string): Promise<State> {
  const path = resolve(dataDir, STATE_FILENAME);
  if (!existsSync(path)) return {};
  const raw = await Bun.file(path).text();
  return parse(raw) ?? {};
}

export async function saveState(dataDir: string, state: State): Promise<void> {
  const path = resolve(dataDir, STATE_FILENAME);
  await Bun.write(path, stringify(state, { sortMapEntries: true, lineWidth: 120 }));
}
