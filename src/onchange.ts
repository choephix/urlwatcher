import { spawn } from "node:child_process";

const DIFF_ENV = "URLWATCHER_DIFF";
const BODY_ENV = "URLWATCHER_BODY";
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
  const expanded = command
    .replaceAll("{{diff}}", `"$${DIFF_ENV}"`)
    .replaceAll("{{body}}", `"$${BODY_ENV}"`)
    .replaceAll("{{alias}}", `"$${ALIAS_ENV}"`)
    .replaceAll("{{url}}", `"$${URL_ENV}"`);

  return new Promise((resolvePromise) => {
    const child = spawn("sh", ["-c", expanded], {
      stdio: "inherit",
      env: {
        ...process.env,
        [DIFF_ENV]: ctx.diff,
        [BODY_ENV]: ctx.body,
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
}
