import { registerNotifier } from "./registry.ts";
import type { NotificationPlugin } from "./types.ts";
import { formatRunBlock } from "./format.ts";

const stdoutNotifier: NotificationPlugin = {
  name: "stdout",

  async notifyRun(report) {
    // write() (not console.log) — formatRunBlock already ends with newlines.
    process.stdout.write(formatRunBlock(report));
  },
};

registerNotifier(stdoutNotifier);
export default stdoutNotifier;
