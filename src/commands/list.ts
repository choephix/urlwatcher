import { resolve } from "node:path";
import type { Config } from "../config/schema.ts";
import { loadState, type State } from "../state.ts";

export async function listCommand(config: Config): Promise<void> {
  if (config.urls.length === 0) {
    console.log("No tracked URLs. Add some with: urlwatcher add <url>");
    return;
  }

  const state = await loadState(resolve(config.dataDir));

  console.log(`Tracking ${config.urls.length} URL(s):\n`);
  for (const entry of config.urls) {
    const converter = entry.htmlConverter ?? config.defaults.htmlConverter;
    const type = entry.contentType ?? "auto";
    const s = state[entry.alias];
    console.log(`  ${entry.alias}`);
    console.log(`    url:          ${entry.url}`);
    console.log(`    converter:    ${converter}`);
    console.log(`    type:         ${type}`);
    if (s?.lastChecked) console.log(`    last checked: ${s.lastChecked}`);
    if (s?.lastChanged) console.log(`    last changed: ${s.lastChanged}`);
    console.log();
  }
}
