import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { registerNotifier } from "./registry.ts";
import type { NotificationPlugin } from "./types.ts";
import { formatRunBlock } from "./format.ts";

const fileNotifier: NotificationPlugin = {
  name: "file",

  async notifyRun(report, entry) {
    if (report.dryRun) return;

    const path = entry.path;
    if (typeof path !== "string" || path.length === 0) {
      throw new Error(
        'file notifier requires a string "path" field (resolved relative to the config file).'
      );
    }

    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, formatRunBlock(report), "utf8");
  },
};

registerNotifier(fileNotifier);
export default fileNotifier;
