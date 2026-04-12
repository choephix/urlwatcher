import { resolve } from "node:path";

interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runGit(cwd: string, args: string[]): Promise<GitResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

export async function isGitRepo(dataDir: string): Promise<boolean> {
  const result = await runGit(dataDir, ["rev-parse", "--git-dir"]);
  if (result.exitCode !== 0) return false;
  // Ensure the .git dir belongs to this directory, not a parent repo
  const gitDir = result.stdout.trim();
  return gitDir === ".git";
}

export async function gitInit(dataDir: string): Promise<void> {
  const result = await runGit(dataDir, ["init"]);
  if (result.exitCode !== 0) {
    throw new Error(`git init failed: ${result.stderr}`);
  }
  // Set local identity so commits work even without global git config
  await runGit(dataDir, ["config", "user.email", "urlwatcher@localhost"]);
  await runGit(dataDir, ["config", "user.name", "urlwatcher"]);
}

export async function gitAdd(dataDir: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  const result = await runGit(dataDir, ["add", ...files]);
  if (result.exitCode !== 0) {
    throw new Error(`git add failed: ${result.stderr}`);
  }
}

export async function gitDiffCached(dataDir: string): Promise<string> {
  const result = await runGit(dataDir, ["diff", "--cached", "--word-diff=plain"]);
  return result.stdout;
}

export async function gitDiffCachedStat(dataDir: string): Promise<string> {
  const result = await runGit(dataDir, ["diff", "--cached", "--stat"]);
  return result.stdout;
}

export async function gitResetHead(dataDir: string): Promise<void> {
  await runGit(dataDir, ["reset", "HEAD"]);
}

export async function gitCommit(dataDir: string, message: string): Promise<string> {
  const result = await runGit(dataDir, ["commit", "-m", message]);
  if (result.exitCode !== 0) {
    throw new Error(`git commit failed: ${result.stderr}`);
  }
  const hashResult = await runGit(dataDir, ["rev-parse", "HEAD"]);
  return hashResult.stdout.trim();
}

export async function gitStatus(dataDir: string): Promise<string> {
  const result = await runGit(dataDir, ["status", "--porcelain"]);
  return result.stdout;
}

export async function isClean(dataDir: string): Promise<boolean> {
  const status = await gitStatus(dataDir);
  return status.trim() === "";
}

export async function gitRestoreFiles(dataDir: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  await runGit(dataDir, ["checkout", "HEAD", "--", ...files]);
}

export async function gitCleanFiles(dataDir: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  const { unlinkSync } = await import("node:fs");
  for (const file of files) {
    try { unlinkSync(resolve(dataDir, file)); } catch {}
  }
}
