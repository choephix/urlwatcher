import { deleteWatcherFile } from "../watchers/writer.ts";

export async function removeCommand(
  watchDir: string,
  alias: string
): Promise<void> {
  const removed = deleteWatcherFile(watchDir, alias);
  if (!removed) {
    throw new Error(`No watcher with alias "${alias}"`);
  }
  console.log(`Removed "${alias}"`);
}
