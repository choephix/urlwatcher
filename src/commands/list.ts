import { resolve } from "node:path";
import type { Config } from "../config/schema.ts";
import { loadState } from "../state.ts";
import { loadSpecs } from "../specs/loader.ts";

export async function listCommand(config: Config): Promise<void> {
  const specs = await loadSpecs(config.specDir);

  if (specs.length === 0) {
    console.log(
      `No target specs found in ${config.specDir}. Add some with: urlwatcher add <url> --alias <name>`
    );
    return;
  }

  const state = await loadState(resolve(config.snapshotDir));

  console.log(`Tracking ${specs.length} URL(s):\n`);
  for (const w of specs) {
    const converter =
      w.contentType === "json"
        ? (w.jsonConverter ?? config.defaults.jsonConverter)
        : w.contentType === "rss"
          ? (w.rssConverter ?? config.defaults.rssConverter)
          : (w.htmlConverter ?? config.defaults.htmlConverter);
    const type = w.contentType ?? "auto";
    const s = state[w.alias];
    const marker = w.enabled ? "" : " (disabled)";
    console.log(`  ${w.alias}${marker}`);
    console.log(`    url:          ${w.url}`);
    console.log(`    converter:    ${converter}`);
    console.log(`    type:         ${type}`);
    if (s?.lastChecked) console.log(`    last checked: ${s.lastChecked}`);
    if (s?.lastChanged) console.log(`    last changed: ${s.lastChanged}`);
    console.log();
  }
}
