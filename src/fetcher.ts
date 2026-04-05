import type { FetchResult } from "./types.ts";

const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB

export async function fetchUrl(url: string, timeout: number): Promise<FetchResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

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
  }
}

export function detectContentType(
  headerContentType: string,
  configContentType?: "html" | "json"
): "html" | "json" {
  if (configContentType) return configContentType;
  if (headerContentType.includes("json")) return "json";
  return "html";
}
