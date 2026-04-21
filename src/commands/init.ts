import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { isGitRepo, gitInit, gitAdd, gitCommit } from "../git/operations.ts";

export async function initCommand(snapshotDir: string, specDir: string): Promise<void> {
  const resolvedSnapshot = resolve(snapshotDir);

  if (!existsSync(resolvedSnapshot)) {
    mkdirSync(resolvedSnapshot, { recursive: true });
    console.log(`Created snapshot directory: ${resolvedSnapshot}`);
  }

  const resolvedSpec = resolve(specDir);
  if (!existsSync(resolvedSpec)) {
    mkdirSync(resolvedSpec, { recursive: true });
    console.log(`Created target spec directory: ${resolvedSpec}`);
  }

  if (await isGitRepo(resolvedSnapshot)) {
    console.log(`Snapshot directory is already a git repo: ${resolvedSnapshot}`);
    return;
  }

  await gitInit(resolvedSnapshot);

  await Bun.write(resolve(resolvedSnapshot, ".gitignore"), ".DS_Store\n");
  await gitAdd(resolvedSnapshot, [".gitignore"]);
  await gitCommit(resolvedSnapshot, "Initialize urlwatcher snapshot repository");

  console.log(`Initialized git repo at: ${resolvedSnapshot}`);
}
