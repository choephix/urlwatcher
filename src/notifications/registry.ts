import type { NotificationPlugin } from "./types.ts";

const notifiers = new Map<string, NotificationPlugin>();

export function registerNotifier(notifier: NotificationPlugin): void {
  notifiers.set(notifier.name, notifier);
}

export function getNotifier(name: string): NotificationPlugin {
  const notifier = notifiers.get(name);
  if (!notifier) {
    const available = Array.from(notifiers.keys()).join(", ");
    throw new Error(`Unknown notifier "${name}". Available: ${available}`);
  }
  return notifier;
}

export function listNotifiers(): NotificationPlugin[] {
  return Array.from(notifiers.values());
}
