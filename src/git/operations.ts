import { resolve } from "node:path";

interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

let gitPath: string | null = null;
function resolveGit(): string {
  if (gitPath) return gitPath;
  const found = Bun.which("git");
  if (!found) {
    throw new Error(
      "urlwatcher requires `git` on PATH, but it could not be found. " +
        "Install git, or ensure it is available in the PATH of whatever runs urlwatcher. " +
        `Current PATH: ${process.env.PATH ?? "(unset)"}`,
    );
  }
  gitPath = found;
  return found;
}

async function runGit(cwd: string, args: string[]): Promise<GitResult> {
  const proc = Bun.spawn([resolveGit(), ...args], {
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

export async function isGitRepo(snapshotDir: string): Promise<boolean> {
  const result = await runGit(snapshotDir, ["rev-parse", "--git-dir"]);
  if (result.exitCode !== 0) return false;
  // Ensure the .git dir belongs to this directory, not a parent repo
  const gitDir = result.stdout.trim();
  return gitDir === ".git";
}

export async function gitInit(snapshotDir: string): Promise<void> {
  const result = await runGit(snapshotDir, ["init", "-b", "main"]);
  if (result.exitCode !== 0) {
    throw new Error(`git init failed: ${result.stderr}`);
  }
  // Set local identity so commits work even without global git config
  await runGit(snapshotDir, ["config", "user.email", "urlwatcher@localhost"]);
  await runGit(snapshotDir, ["config", "user.name", "urlwatcher"]);
}

export async function gitAdd(snapshotDir: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  const result = await runGit(snapshotDir, ["add", ...files]);
  if (result.exitCode !== 0) {
    throw new Error(`git add failed: ${result.stderr}`);
  }
}

export async function gitAddAll(snapshotDir: string): Promise<void> {
  const result = await runGit(snapshotDir, ["add", "-A"]);
  if (result.exitCode !== 0) {
    throw new Error(`git add -A failed: ${result.stderr}`);
  }
}

export async function gitDiffCached(snapshotDir: string): Promise<string> {
  const result = await runGit(snapshotDir, ["diff", "--cached", "--word-diff=plain"]);
  return result.stdout;
}

export async function gitLogForPaths(snapshotDir: string, files: string[]): Promise<string[]> {
  if (files.length === 0) return [];
  const result = await runGit(snapshotDir, ["log", "--format=%H", "--", ...files]);
  if (result.exitCode !== 0) {
    throw new Error(`git log failed: ${result.stderr}`);
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function gitShowDiffForPaths(
  snapshotDir: string,
  rev: string,
  files: string[]
): Promise<string> {
  if (files.length === 0) return "";
  const result = await runGit(snapshotDir, [
    "show",
    "--format=",
    "--word-diff=plain",
    "--find-renames",
    "--root",
    rev,
    "--",
    ...files,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`git show failed: ${result.stderr}`);
  }
  return result.stdout;
}

export async function gitDiffCachedNumstat(
  snapshotDir: string
): Promise<Map<string, { added: number; removed: number }>> {
  const result = await runGit(snapshotDir, ["diff", "--cached", "--numstat"]);
  const map = new Map<string, { added: number; removed: number }>();
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    // Format: `<added>\t<removed>\t<path>`. Binary files report "-" for counts.
    const [addedStr, removedStr, ...nameParts] = line.split("\t");
    const name = nameParts.join("\t");
    const added = addedStr === "-" ? 0 : parseInt(addedStr ?? "0", 10);
    const removed = removedStr === "-" ? 0 : parseInt(removedStr ?? "0", 10);
    map.set(name, { added, removed });
  }
  return map;
}

export async function gitResetHead(snapshotDir: string): Promise<void> {
  await runGit(snapshotDir, ["reset", "HEAD"]);
}

export async function gitCommit(snapshotDir: string, message: string): Promise<string> {
  const result = await runGit(snapshotDir, ["commit", "-m", message]);
  if (result.exitCode !== 0) {
    throw new Error(`git commit failed: ${result.stderr}`);
  }
  const hashResult = await runGit(snapshotDir, ["rev-parse", "HEAD"]);
  return hashResult.stdout.trim();
}

export async function gitStatus(snapshotDir: string): Promise<string> {
  const result = await runGit(snapshotDir, ["status", "--porcelain"]);
  return result.stdout;
}

export async function isClean(snapshotDir: string): Promise<boolean> {
  const status = await gitStatus(snapshotDir);
  return status.trim() === "";
}

export async function gitRestoreFiles(snapshotDir: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  await runGit(snapshotDir, ["checkout", "HEAD", "--", ...files]);
}

export async function gitCleanFiles(snapshotDir: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  const { unlinkSync } = await import("node:fs");
  for (const file of files) {
    try { unlinkSync(resolve(snapshotDir, file)); } catch {}
  }
}
