import { XMLParser } from "fast-xml-parser";
import { stringify } from "yaml";
import { registerConverter } from "./registry.ts";
import type { ConverterPlugin } from "./types.ts";

interface NormalizedItem {
  id: string;
  title?: string;
  link?: string;
  published?: string;
  updated?: string;
  author?: string;
  summary?: string;
}

interface NormalizedFeed {
  title?: string;
  link?: string;
  description?: string;
  items: NormalizedItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  textNodeName: "#text",
});

const rssConverter: ConverterPlugin = {
  name: "rss",
  description: "Parses RSS 2.0 / Atom feeds into sorted YAML for clean diffs",
  supportedContentTypes: [
    "application/rss+xml",
    "application/atom+xml",
    "application/xml",
    "text/xml",
  ],
  handlesOwnFetching: false,

  async convert(_url, body, _contentType) {
    const parsed = parser.parse(body);
    const feed = normalize(parsed);
    feed.items.sort((a, b) => a.id.localeCompare(b.id));
    const content = stringify(feed, { sortMapEntries: true, lineWidth: 120 });
    return { content, extension: "yaml" };
  },
};

function text(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const t = (v as any)["#text"];
    if (typeof t === "string") return t.trim() || undefined;
  }
  return undefined;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function atomLink(link: unknown): string | undefined {
  if (!link) return undefined;
  const arr = asArray(link as any);
  const alternate = arr.find((l: any) => !l["@_rel"] || l["@_rel"] === "alternate") ?? arr[0];
  if (!alternate) return undefined;
  if (typeof alternate === "string") return alternate;
  return alternate["@_href"] ?? text(alternate);
}

function normalize(parsed: any): NormalizedFeed {
  if (parsed?.rss?.channel) {
    const ch = parsed.rss.channel;
    const items = asArray(ch.item).map((it: any): NormalizedItem => {
      const link = text(it.link);
      const guid = text(it.guid);
      return {
        id: guid ?? link ?? text(it.title) ?? "",
        title: text(it.title),
        link,
        published: text(it.pubDate),
        author: text(it.author) ?? text(it["dc:creator"]),
        summary: text(it.description),
      };
    });
    return {
      title: text(ch.title),
      link: text(ch.link),
      description: text(ch.description),
      items,
    };
  }

  if (parsed?.feed) {
    const f = parsed.feed;
    const items = asArray(f.entry).map((e: any): NormalizedItem => {
      const link = atomLink(e.link);
      const id = text(e.id);
      return {
        id: id ?? link ?? text(e.title) ?? "",
        title: text(e.title),
        link,
        published: text(e.published),
        updated: text(e.updated),
        author: text(e.author?.name) ?? text(e.author),
        summary: text(e.summary) ?? text(e.content),
      };
    });
    return {
      title: text(f.title),
      link: atomLink(f.link),
      items,
    };
  }

  return { items: [] };
}

registerConverter(rssConverter);
export default rssConverter;
