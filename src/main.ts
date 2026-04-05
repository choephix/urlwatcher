#!/usr/bin/env bun

import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "./config/loader.ts";
import { initCommand } from "./commands/init.ts";
import { checkCommand } from "./commands/check.ts";
import { addCommand } from "./commands/add.ts";
import { removeCommand } from "./commands/remove.ts";
import { listCommand } from "./commands/list.ts";
import { getNotifier } from "./notifications/registry.ts";

// Register notifiers
import "./notifications/stdout.ts";

const program = new Command()
  .name("urlwatcher")
  .description("Track changes to web pages and API endpoints using git")
  .option("-c, --config <path>", "Path to config file");

program
  .command("init")
  .description("Initialize the data directory as a git repo")
  .action(async () => {
    const { config } = await loadConfig(program.opts().config);
    const dataDir = resolve(config.dataDir);
    await initCommand(dataDir);
  });

program
  .command("check [alias]")
  .description("Check tracked URLs for changes")
  .action(async (alias?: string) => {
    const { config } = await loadConfig(program.opts().config);
    const results = await checkCommand(config, alias);

    const changed = results.filter((r) => r.changed);
    const errors = results.filter((r) => r.error);
    const unchanged = results.filter((r) => !r.changed && !r.error);

    // Notify for changed URLs
    for (const r of changed) {
      for (const notifConfig of config.notifications) {
        const notifier = getNotifier(notifConfig.type);
        await notifier.notify({
          alias: r.alias,
          url: r.url,
          diff: r.diff ?? "",
          isNew: r.isNew ?? false,
          commitHash: "",
          timestamp: new Date(),
        });
      }
    }

    // Summary
    if (results.length > 0) {
      console.log("\n--- Summary ---");
      if (changed.length > 0)
        console.log(`  Changed:   ${changed.map((r) => r.alias).join(", ")}`);
      if (unchanged.length > 0)
        console.log(`  Unchanged: ${unchanged.map((r) => r.alias).join(", ")}`);
      if (errors.length > 0)
        console.log(`  Errors:    ${errors.map((r) => r.alias).join(", ")}`);
    }
  });

program
  .command("add <url>")
  .description("Add a URL to track")
  .requiredOption("-a, --alias <name>", "Alias for this URL")
  .option("--html-converter <name>", "HTML converter to use (turndown, jina)")
  .option("--content-type <type>", "Force content type (html, json)")
  .action(async (url: string, opts: any) => {
    const { configPath } = await loadConfig(program.opts().config);
    await addCommand(configPath, url, {
      alias: opts.alias,
      htmlConverter: opts.htmlConverter,
      contentType: opts.contentType,
    });
  });

program
  .command("remove <alias>")
  .description("Stop tracking a URL")
  .action(async (alias: string) => {
    const { configPath } = await loadConfig(program.opts().config);
    await removeCommand(configPath, alias);
  });

program
  .command("list")
  .description("List all tracked URLs")
  .action(async () => {
    const { config } = await loadConfig(program.opts().config);
    listCommand(config);
  });

program.parse();
