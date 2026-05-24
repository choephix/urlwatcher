import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const DIFF_FILE_ENV = "URLWATCHER_DIFF_FILE";
const BODY_FILE_ENV = "URLWATCHER_BODY_FILE";
const ALIAS_ENV = "URLWATCHER_ALIAS";
const URL_ENV = "URLWATCHER_URL";
const ZO_MODEL_ENV = "URLWATCHER_ZO_MODEL";
const ZO_MODEL_WRAPPER = "scripts/zo-model.ts";

export interface OnChangeContext {
  alias: string;
  url: string;
  diff: string;
  body: string;
}

export interface OnChangeOptions {
  traceLogPath?: string;
}

async function appendTrace(path: string | undefined, message: string): Promise<void> {
  if (!path) return;
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, message, "utf8");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠ could not write onChange trace log: ${errorMessage}`);
  }
}

function indent(text: string): string {
  return text.split("\n").map((line) => `    ${line}`).join("\n");
}

export async function runOnChange(
  command: string,
  ctx: OnChangeContext,
  options: OnChangeOptions = {}
): Promise<{ code: number | null; stdout: string; stderr: string }> {
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
    await appendTrace(
      options.traceLogPath,
      `\n[onChange:${ctx.alias}] started at ${new Date().toISOString()}\n` +
        `[onChange:${ctx.alias}] url: ${ctx.url}\n`
    );

    return await new Promise((resolvePromise) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;

      const model = process.env[ZO_MODEL_ENV];
      const modifiedExpanded = model && expanded.startsWith("zo ")
        ? `bun ${ZO_MODEL_WRAPPER} --model "${model}" ${expanded.slice(3)}`
        : expanded;

      const child = spawn("sh", ["-c", modifiedExpanded], {
        cwd: join(import.meta.dir, ".."),
        env: {
          ...process.env,
          [DIFF_FILE_ENV]: diffPath,
          [BODY_FILE_ENV]: bodyPath,
          [ALIAS_ENV]: ctx.alias,
          [URL_ENV]: ctx.url,
        },
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.on("exit", async (code) => {
        if (settled) return;
        settled = true;
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderr = Buffer.concat(stderrChunks).toString("utf8");

        await appendTrace(
          options.traceLogPath,
          `[onChange:${ctx.alias}] finished at ${new Date().toISOString()}\n` +
            `[onChange:${ctx.alias}] exit code: ${code ?? "null"}\n` +
            (stdout ? `[onChange:${ctx.alias}] stdout:\n${indent(stdout)}\n` : "") +
            (stderr ? `[onChange:${ctx.alias}] stderr:\n${indent(stderr)}\n` : "")
        );

        resolvePromise({ code, stdout, stderr });
      });

      child.on("error", async (err) => {
        if (settled) return;
        settled = true;

        console.warn(`  ⚠ onChange for ${ctx.alias}: spawn error: ${err.message}`);
        await appendTrace(
          options.traceLogPath,
          `[onChange:${ctx.alias}] spawn error at ${new Date().toISOString()}: ${err.message}\n`
        );
        resolvePromise({ code: 1, stdout: "", stderr: err.message });
      });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
