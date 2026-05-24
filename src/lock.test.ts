import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireLock } from "./lock.ts";

const LOCK_FILENAME = ".urlwatcher.lock";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "urlwatcher-lock-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("acquireLock", () => {
  test("creates a lock file containing the current PID and removes it on release", () => {
    const release = acquireLock(dir);
    const lockPath = join(dir, LOCK_FILENAME);

    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(lockPath, "utf8").trim()).toBe(String(process.pid));

    release();
    expect(existsSync(lockPath)).toBe(false);
  });

  test("throws while another live PID still holds the lock", () => {
    const release = acquireLock(dir);
    try {
      expect(() => acquireLock(dir)).toThrow(/already running/);
    } finally {
      release();
    }
  });

  test("can be reacquired after release", () => {
    acquireLock(dir)();
    const release = acquireLock(dir);
    expect(existsSync(join(dir, LOCK_FILENAME))).toBe(true);
    release();
  });

  test("recovers a stale lock from a dead PID", () => {
    const lockPath = join(dir, LOCK_FILENAME);
    // 2^31 - 1 — practically guaranteed to be a non-existent PID.
    writeFileSync(lockPath, "2147483646");
    expect(existsSync(lockPath)).toBe(true);

    const release = acquireLock(dir);
    expect(readFileSync(lockPath, "utf8").trim()).toBe(String(process.pid));
    release();
    expect(existsSync(lockPath)).toBe(false);
  });
});
