import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { isGitRepo, gitInit, gitAdd, gitCommit } from "../git/operations.ts";

export async function initCommand(dataDir: string): Promise<void> {
  const resolved = resolve(dataDir);

  if (!existsSync(resolved)) {
    mkdirSync(resolved, { recursive: true });
    console.log(`Created data directory: ${resolved}`);
  }

  if (await isGitRepo(resolved)) {
    console.log(`Data directory is already a git repo: ${resolved}`);
    return;
  }

  await gitInit(resolved);

  await Bun.write(resolve(resolved, ".gitignore"), ".DS_Store\n");
  await gitAdd(resolved, [".gitignore"]);
  await gitCommit(resolved, "Initialize urlwatcher data repository");

  console.log(`Initialized git repo at: ${resolved}`);
}
