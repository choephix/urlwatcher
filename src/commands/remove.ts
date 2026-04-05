import { removeUrlFromConfig } from "../config/writer.ts";

export async function removeCommand(
  configPath: string,
  alias: string
): Promise<void> {
  const removed = await removeUrlFromConfig(configPath, alias);
  if (!removed) {
    throw new Error(`No tracked URL with alias "${alias}"`);
  }
  console.log(`Removed "${alias}" from tracking`);
}
