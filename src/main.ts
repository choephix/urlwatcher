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
import { runOnChange } from "./onchange.ts";

import "./notifications/stdout.ts";
import "./notifications/file.ts";

const program = new Command()
  .name("urlwatcher")
  .description("Track changes to web pages and API endpoints using git")
  .option("-c, --config <path>", "Path to config file");

program
  .command("init")
  .description("Initialize the data directory as a git repo and create the watcher directory")
  .action(async () => {
    const { config } = await loadConfig(program.opts().config);
    await initCommand(resolve(config.dataDir), resolve(config.watchDir));
  });

program
  .command("check [alias]")
  .description("Check tracked URLs for changes")
  .option("-n, --dry-run", "Fetch and diff but don't commit or update state")
  .action(async (alias: string | undefined, opts: { dryRun?: boolean }) => {
    const { config } = await loadConfig(program.opts().config);
    const timestamp = new Date();
    const results = await checkCommand(config, alias, opts.dryRun);

    if (results.length > 0) {
      for (const notifConfig of config.notifications) {
        const notifier = getNotifier(notifConfig.type);
        await notifier.notifyRun(
          { timestamp, results, dryRun: opts.dryRun ?? false },
          notifConfig
        );
      }
    }

    if (config.onChange && !opts.dryRun) {
      for (const r of results) {
        if (!r.changed) continue;
        await runOnChange(config.onChange, {
          alias: r.alias,
          url: r.url,
          diff: r.diff ?? "",
          body: r.body ?? "",
        });
      }
    }
  });

program
  .command("add <url>")
  .description("Add a URL to track (creates a watcher Markdown file)")
  .requiredOption("-a, --alias <name>", "Alias for this URL")
  .option("--html-converter <name>", "HTML converter to use (turndown, jina)")
  .option("--content-type <type>", "Force content type (html, json)")
  .action(async (url: string, opts: any) => {
    const { config } = await loadConfig(program.opts().config);
    await addCommand(config.watchDir, url, {
      alias: opts.alias,
      htmlConverter: opts.htmlConverter,
      contentType: opts.contentType,
    });
  });

program
  .command("remove <alias>")
  .description("Stop tracking a URL (deletes its watcher Markdown file)")
  .action(async (alias: string) => {
    const { config } = await loadConfig(program.opts().config);
    await removeCommand(config.watchDir, alias);
  });

program
  .command("list")
  .description("List all tracked URLs")
  .action(async () => {
    const { config } = await loadConfig(program.opts().config);
    await listCommand(config);
  });

program.parse();
