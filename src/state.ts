import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { parse, stringify } from "yaml";

const STATE_FILENAME = ".state.yaml";

export interface UrlState {
  lastChecked: string;
  lastChanged?: string;
}

export type State = Record<string, UrlState>;

export async function loadState(snapshotDir: string): Promise<State> {
  const path = resolve(snapshotDir, STATE_FILENAME);
  if (!existsSync(path)) return {};
  const raw = await Bun.file(path).text();
  return parse(raw) ?? {};
}

export async function saveState(snapshotDir: string, state: State): Promise<void> {
  const path = resolve(snapshotDir, STATE_FILENAME);
  await Bun.write(path, stringify(state, { sortMapEntries: true, lineWidth: 120 }));
}
