const GIT_DIFF_HEADER = /^diff --git a\/(.+) b\/(.+)$/;

function matchingPath(line: string, paths: Set<string>): boolean {
  const match = GIT_DIFF_HEADER.exec(line);
  if (!match) return false;
  const fromPath = match[1]!;
  const toPath = match[2]!;
  return paths.has(fromPath) || paths.has(toPath);
}

function shouldSkipMetadata(line: string): boolean {
  return (
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("new file mode") ||
    line.startsWith("deleted file mode") ||
    line.startsWith("similarity index ") ||
    line.startsWith("rename from ") ||
    line.startsWith("rename to ") ||
    line.startsWith("old mode ") ||
    line.startsWith("new mode ") ||
    line.startsWith("Binary files ") ||
    line.startsWith("\\ No newline")
  );
}

export function extractDiffForPaths(fullDiff: string, targetPaths: string[]): string {
  const paths = new Set(targetPaths);
  const chunks: string[] = [];
  let capturing = false;

  for (const line of fullDiff.split("\n")) {
    if (line.startsWith("diff --git")) {
      capturing = matchingPath(line, paths);
      continue;
    }
    if (!capturing || shouldSkipMetadata(line)) continue;
    chunks.push(line);
  }

  return chunks.join("\n").trim();
}
