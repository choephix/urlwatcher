import { resolve } from "node:path";
import type { Config } from "../config/schema.ts";
import { loadState } from "../state.ts";
import { loadWatchers } from "../watchers/loader.ts";

export async function listCommand(config: Config): Promise<void> {
  const watchers = await loadWatchers(config.watchDir);

  if (watchers.length === 0) {
    console.log(
      `No watchers found in ${config.watchDir}. Add some with: urlwatcher add <url> --alias <name>`
    );
    return;
  }

  const state = await loadState(resolve(config.dataDir));

  console.log(`Tracking ${watchers.length} URL(s):\n`);
  for (const w of watchers) {
    const converter =
      w.contentType === "json"
        ? (w.jsonConverter ?? config.defaults.jsonConverter)
        : w.contentType === "rss"
          ? (w.rssConverter ?? config.defaults.rssConverter)
          : (w.htmlConverter ?? config.defaults.htmlConverter);
    const type = w.contentType ?? "auto";
    const s = state[w.alias];
    console.log(`  ${w.alias}`);
    console.log(`    url:          ${w.url}`);
    console.log(`    converter:    ${converter}`);
    console.log(`    type:         ${type}`);
    if (s?.lastChecked) console.log(`    last checked: ${s.lastChecked}`);
    if (s?.lastChanged) console.log(`    last changed: ${s.lastChanged}`);
    console.log();
  }
}
