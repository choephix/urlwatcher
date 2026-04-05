export interface ChangeReport {
  alias: string;
  url: string;
  diff: string;
  commitHash: string;
  timestamp: Date;
}

export interface NotificationPlugin {
  name: string;
  notify(report: ChangeReport): Promise<void>;
  notifyError?(alias: string, url: string, error: Error): Promise<void>;
}
