import { parseDocument } from "yaml";

export async function addUrlToConfig(
  configPath: string,
  entry: { alias: string; url: string; htmlConverter?: string; contentType?: "html" | "json" }
): Promise<void> {
  const raw = await Bun.file(configPath).text();
  const doc = parseDocument(raw);

  const urlsSeq = doc.getIn(["urls"], true) as any;
  const urls = urlsSeq?.toJSON() as any[] | undefined;

  if (urls?.some((u: any) => u.alias === entry.alias)) {
    throw new Error(`Alias "${entry.alias}" already exists in config`);
  }

  const newEntry: Record<string, string> = { alias: entry.alias, url: entry.url };
  if (entry.htmlConverter) newEntry.htmlConverter = entry.htmlConverter;
  if (entry.contentType) newEntry.contentType = entry.contentType;

  if (!urlsSeq) {
    doc.set("urls", [newEntry]);
  } else {
    urlsSeq.add(doc.createNode(newEntry));
  }

  await Bun.write(configPath, doc.toString({ lineWidth: 120 }));
}

export async function removeUrlFromConfig(
  configPath: string,
  alias: string
): Promise<boolean> {
  const raw = await Bun.file(configPath).text();
  const doc = parseDocument(raw);

  const urlsSeq = doc.getIn(["urls"], true) as any;
  if (!urlsSeq) return false;

  const urls = urlsSeq.toJSON() as any[];
  const index = urls.findIndex((u: any) => u.alias === alias);
  if (index === -1) return false;

  urlsSeq.delete(index);

  await Bun.write(configPath, doc.toString({ lineWidth: 120 }));
  return true;
}
