import type { CheckResult } from "../types.ts";
import type { RunReport } from "./types.ts";

const RULE = "═".repeat(60);
const BLANK_LINES_BETWEEN_RUNS = 3;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTimestamp(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatStat(added: number | undefined, removed: number | undefined): string {
  const parts: string[] = [];
  if (added && added > 0) parts.push(`+${added}`);
  if (removed && removed > 0) parts.push(`-${removed}`);
  return parts.length ? `  ${parts.join(" ")}` : "";
}

function resultLines(r: CheckResult): string[] {
  if (r.error) return [`[${r.alias}] error  ${r.error}`];
  if (r.changed) {
    const label = r.isNew ? "new snapshot" : "changed";
    const head = `[${r.alias}] ${label}${formatStat(r.added, r.removed)}`;
    return r.diff ? [head, r.diff] : [head];
  }
  return [`[${r.alias}] no changes`];
}

function hasDiff(r: CheckResult): boolean {
  return Boolean(r.changed && r.diff);
}

/**
 * Format a run as a human-readable block. Consecutive no-change / error
 * entries are packed tight; entries with a diff get a blank line on either
 * side for breathing room. Output ends with BLANK_LINES_BETWEEN_RUNS empty
 * lines so concatenated blocks keep their spacing.
 */
export function formatRunBlock(report: RunReport): string {
  const lines: string[] = [
    RULE,
    `  ${formatTimestamp(report.timestamp)}`,
    RULE,
    "",
  ];

  for (let i = 0; i < report.results.length; i++) {
    const r = report.results[i]!;
    const prev = i > 0 ? report.results[i - 1]! : undefined;
    const needsBlank = prev !== undefined && (hasDiff(prev) || hasDiff(r));
    if (needsBlank) lines.push("");
    lines.push(...resultLines(r));
  }

  for (let i = 0; i < BLANK_LINES_BETWEEN_RUNS + 1; i++) lines.push("");

  return lines.join("\n");
}
