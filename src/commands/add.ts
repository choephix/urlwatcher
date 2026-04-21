import { createSpecFile } from "../specs/writer.ts";
import { listConverters } from "../converters/registry.ts";

import "../converters/yaml-converter.ts";
import "../converters/turndown.ts";
import "../converters/jina.ts";
import "../converters/rss.ts";

export async function addCommand(
  specDir: string,
  url: string,
  options: { alias: string; htmlConverter?: string; contentType?: string }
): Promise<void> {
  if (options.htmlConverter) {
    const available = listConverters().map((c) => c.name);
    if (!available.includes(options.htmlConverter)) {
      throw new Error(
        `Unknown converter "${options.htmlConverter}". Available: ${available.join(", ")}`
      );
    }
  }

  const contentType =
    options.contentType === "html" ||
    options.contentType === "json" ||
    options.contentType === "rss"
      ? options.contentType
      : undefined;

  const path = await createSpecFile(specDir, options.alias, {
    url,
    htmlConverter: options.htmlConverter,
    contentType,
  });

  console.log(`Added "${options.alias}" → ${url}`);
  console.log(`  ${path}`);
}
