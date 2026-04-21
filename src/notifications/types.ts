import type { CheckResult } from "../types.ts";

export interface NotificationEntry {
  type: string;
  [key: string]: unknown;
}

export interface RunReport {
  timestamp: Date;
  results: CheckResult[];
  dryRun: boolean;
}

export interface NotificationPlugin {
  name: string;
  notifyRun(report: RunReport, entry: NotificationEntry): Promise<void>;
}
