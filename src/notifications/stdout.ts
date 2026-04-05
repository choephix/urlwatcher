import { registerNotifier } from "./registry.ts";
import type { NotificationPlugin } from "./types.ts";

const stdoutNotifier: NotificationPlugin = {
  name: "stdout",

  async notify(report) {
    console.log(`\n--- ${report.alias} (${report.url}) ---`);
    console.log(report.diff);
  },

  async notifyError(alias, url, error) {
    console.warn(`⚠ ${alias} (${url}): ${error.message}`);
  },
};

registerNotifier(stdoutNotifier);
export default stdoutNotifier;
