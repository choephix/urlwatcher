import type { Config } from "../config/schema.ts";

export function listCommand(config: Config): void {
  if (config.urls.length === 0) {
    console.log("No tracked URLs. Add some with: urlwatcher add <url>");
    return;
  }

  console.log(`Tracking ${config.urls.length} URL(s):\n`);
  for (const entry of config.urls) {
    const converter = entry.htmlConverter ?? config.defaults.htmlConverter;
    const type = entry.contentType ?? "auto";
    console.log(`  ${entry.alias}`);
    console.log(`    url:       ${entry.url}`);
    console.log(`    converter: ${converter}`);
    console.log(`    type:      ${type}`);
    console.log();
  }
}
