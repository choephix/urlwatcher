import { parse, stringify } from "yaml";

export async function addUrlToConfig(
  configPath: string,
  entry: { alias: string; url: string; htmlConverter?: string; contentType?: "html" | "json" }
): Promise<void> {
  const raw = await Bun.file(configPath).text();
  const doc = parse(raw) ?? {};
  doc.urls = doc.urls ?? [];

  const existing = doc.urls.find((u: any) => u.alias === entry.alias);
  if (existing) {
    throw new Error(`Alias "${entry.alias}" already exists in config`);
  }

  const newEntry: Record<string, string> = { alias: entry.alias, url: entry.url };
  if (entry.htmlConverter) newEntry.htmlConverter = entry.htmlConverter;
  if (entry.contentType) newEntry.contentType = entry.contentType;

  doc.urls.push(newEntry);
  await Bun.write(configPath, stringify(doc, { lineWidth: 120 }));
}

export async function removeUrlFromConfig(
  configPath: string,
  alias: string
): Promise<boolean> {
  const raw = await Bun.file(configPath).text();
  const doc = parse(raw) ?? {};
  doc.urls = doc.urls ?? [];

  const before = doc.urls.length;
  doc.urls = doc.urls.filter((u: any) => u.alias !== alias);

  if (doc.urls.length === before) return false;

  await Bun.write(configPath, stringify(doc, { lineWidth: 120 }));
  return true;
}
