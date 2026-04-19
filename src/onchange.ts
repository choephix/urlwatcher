import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIFF_FILE_ENV = "URLWATCHER_DIFF_FILE";
const BODY_FILE_ENV = "URLWATCHER_BODY_FILE";
const ALIAS_ENV = "URLWATCHER_ALIAS";
const URL_ENV = "URLWATCHER_URL";

export interface OnChangeContext {
  alias: string;
  url: string;
  diff: string;
  body: string;
}

export async function runOnChange(
  command: string,
  ctx: OnChangeContext
): Promise<{ code: number | null }> {
  const dir = mkdtempSync(join(tmpdir(), "urlwatcher-"));
  const diffPath = join(dir, "diff");
  const bodyPath = join(dir, "body");
  writeFileSync(diffPath, ctx.diff);
  writeFileSync(bodyPath, ctx.body);

  const expanded = command
    .replaceAll("{{diff}}", `"$${DIFF_FILE_ENV}"`)
    .replaceAll("{{body}}", `"$${BODY_FILE_ENV}"`)
    .replaceAll("{{alias}}", `"$${ALIAS_ENV}"`)
    .replaceAll("{{url}}", `"$${URL_ENV}"`);

  try {
    return await new Promise((resolvePromise) => {
      const child = spawn("sh", ["-c", expanded], {
        stdio: "inherit",
        env: {
          ...process.env,
          [DIFF_FILE_ENV]: diffPath,
          [BODY_FILE_ENV]: bodyPath,
          [ALIAS_ENV]: ctx.alias,
          [URL_ENV]: ctx.url,
        },
      });
      child.on("exit", (code) => resolvePromise({ code }));
      child.on("error", (err) => {
        console.warn(`  ⚠ onChange for ${ctx.alias}: ${err.message}`);
        resolvePromise({ code: 1 });
      });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
