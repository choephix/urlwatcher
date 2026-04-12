import { openSync, writeSync, closeSync, readFileSync, unlinkSync, constants } from "node:fs";
import { resolve } from "node:path";

const LOCK_FILENAME = ".urlwatcher.lock";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(dataDir: string): () => void {
  const lockPath = resolve(dataDir, LOCK_FILENAME);

  try {
    const fd = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
    writeSync(fd, String(process.pid));
    closeSync(fd);
  } catch (err: any) {
    if (err.code !== "EEXIST") throw err;

    // Lock file exists — check if the holding process is still alive
    let existingPid: number | undefined;
    try {
      existingPid = parseInt(readFileSync(lockPath, "utf8").trim(), 10);
    } catch {}

    if (existingPid && isProcessAlive(existingPid)) {
      throw new Error(
        `Another urlwatcher process (PID ${existingPid}) is already running on this data directory.`
      );
    }

    // Stale lock — remove and retry
    try { unlinkSync(lockPath); } catch {}
    const fd = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
    writeSync(fd, String(process.pid));
    closeSync(fd);
  }

  return () => {
    try { unlinkSync(lockPath); } catch {}
  };
}
