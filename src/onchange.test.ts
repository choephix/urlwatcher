import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOnChange } from "./onchange.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "urlwatcher-onchange-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const ctx = {
  alias: "blog",
  url: "https://example.com/blog",
  diff: "DIFF-CONTENT-LINE-1\nDIFF-CONTENT-LINE-2\n",
  body: "BODY-CONTENT\n",
};

describe("runOnChange", () => {
  test("returns exit 0 and stdout for a successful command", async () => {
    const result = await runOnChange("printf hello-from-onchange", ctx);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("hello-from-onchange");
    expect(result.stderr).toBe("");
  });

  test("propagates non-zero exit codes", async () => {
    const result = await runOnChange("exit 7", ctx);
    expect(result.code).toBe(7);
  });

  test("exposes alias and url via env vars and {{alias}}/{{url}} placeholders", async () => {
    const result = await runOnChange(
      'printf "env:%s|%s tpl:%s|%s" "$URLWATCHER_ALIAS" "$URLWATCHER_URL" {{alias}} {{url}}',
      ctx
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      "env:blog|https://example.com/blog tpl:blog|https://example.com/blog"
    );
  });

  test("writes diff and body to temp files referenced by {{diff}}/{{body}}", async () => {
    const result = await runOnChange(
      'printf "DIFF:"; cat {{diff}}; printf "BODY:"; cat {{body}}',
      ctx
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("DIFF:" + ctx.diff);
    expect(result.stdout).toContain("BODY:" + ctx.body);
  });

  test("cleans up the temp dir after the command exits", async () => {
    const result = await runOnChange('printf "%s" "$URLWATCHER_DIFF_FILE"', ctx);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/urlwatcher-/);
    expect(existsSync(result.stdout)).toBe(false);
  });

  test("appends a trace block to traceLogPath when provided", async () => {
    const traceLogPath = join(dir, "nested", "trace.log");
    const result = await runOnChange("printf out-data", ctx, { traceLogPath });
    expect(result.code).toBe(0);
    expect(existsSync(traceLogPath)).toBe(true);
    const contents = readFileSync(traceLogPath, "utf8");
    expect(contents).toContain(`[onChange:${ctx.alias}] started at`);
    expect(contents).toContain(`[onChange:${ctx.alias}] url: ${ctx.url}`);
    expect(contents).toContain(`[onChange:${ctx.alias}] exit code: 0`);
    expect(contents).toContain("out-data");
  });
});
