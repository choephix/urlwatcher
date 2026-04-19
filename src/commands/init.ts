import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { isGitRepo, gitInit, gitAdd, gitCommit } from "../git/operations.ts";

export async function initCommand(dataDir: string, watchDir: string): Promise<void> {
  const resolvedData = resolve(dataDir);

  if (!existsSync(resolvedData)) {
    mkdirSync(resolvedData, { recursive: true });
    console.log(`Created data directory: ${resolvedData}`);
  }

  const resolvedWatch = resolve(watchDir);
  if (!existsSync(resolvedWatch)) {
    mkdirSync(resolvedWatch, { recursive: true });
    console.log(`Created watcher directory: ${resolvedWatch}`);
  }

  if (await isGitRepo(resolvedData)) {
    console.log(`Data directory is already a git repo: ${resolvedData}`);
    return;
  }

  await gitInit(resolvedData);

  await Bun.write(resolve(resolvedData, ".gitignore"), ".DS_Store\n");
  await gitAdd(resolvedData, [".gitignore"]);
  await gitCommit(resolvedData, "Initialize urlwatcher data repository");

  console.log(`Initialized git repo at: ${resolvedData}`);
}
