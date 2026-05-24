import type { FetchResult } from "./types.ts";

const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_USER_AGENT = "urlwatcher/0.0 (+https://github.com/choephix/urlwatcher)";

function getUserAgent(): string {
  return process.env.URLWATCHER_USER_AGENT || DEFAULT_USER_AGENT;
}

export async function fetchUrl(url: string, timeout: number): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": getUserAgent() },
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return { ok: false, error: `Response too large: ${contentLength} bytes (max ${MAX_BODY_SIZE})` };
    }

    const body = await response.text();
    if (body.length > MAX_BODY_SIZE) {
      return { ok: false, error: `Response body too large: ${body.length} bytes (max ${MAX_BODY_SIZE})` };
    }

    const contentType = response.headers.get("content-type") ?? "text/html";
    return { ok: true, body, contentType };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { ok: false, error: `Timeout after ${timeout}ms` };
    }
    return { ok: false, error: err.message ?? String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export function detectContentType(
  headerContentType: string,
  body?: string,
  configContentType?: "html" | "json" | "rss"
): "html" | "json" | "rss" {
  if (configContentType) return configContentType;
  const ct = headerContentType.toLowerCase();
  if (ct.includes("rss") || ct.includes("atom")) return "rss";
  if (ct.includes("json")) return "json";
  if (ct.includes("xml") && body && looksLikeFeed(body)) return "rss";
  if (body) {
    const head = body.trimStart().slice(0, 512).toLowerCase();
    if (head.includes("<rss") || head.includes("<feed")) return "rss";
  }
  return "html";
}

function looksLikeFeed(body: string): boolean {
  const head = body.trimStart().slice(0, 512).toLowerCase();
  return head.includes("<rss") || head.includes("<feed");
}
