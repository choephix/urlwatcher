import { deleteSpecFile } from "../specs/writer.ts";

export async function removeCommand(
  specDir: string,
  alias: string
): Promise<void> {
  const removed = deleteSpecFile(specDir, alias);
  if (!removed) {
    throw new Error(`No target spec with alias "${alias}"`);
  }
  console.log(`Removed "${alias}"`);
}
