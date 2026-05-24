import { afterEach, describe, expect, test } from "bun:test";
import { detectContentType, fetchUrl } from "./fetcher.ts";

let server: ReturnType<typeof Bun.serve> | undefined;

afterEach(() => {
  server?.stop(true);
  server = undefined;
  delete process.env.URLWATCHER_USER_AGENT;
});

describe("fetchUrl", () => {
  test("applies timeout while reading the response body", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        let timeoutId: Timer | undefined;
        const body = new ReadableStream({
          start(controller) {
            timeoutId = setTimeout(() => {
              controller.enqueue(new TextEncoder().encode("late body"));
              controller.close();
            }, 100);
          },
          cancel() {
            if (timeoutId) clearTimeout(timeoutId);
          },
        });
        return new Response(body, {
          headers: { "content-type": "text/plain" },
        });
      },
    });

    const result = await fetchUrl(`http://127.0.0.1:${server.port}`, 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Timeout after 10ms");
    }
  });

  test("sends a default urlwatcher User-Agent header", async () => {
    server = Bun.serve({
      port: 0,
      fetch(req) {
        return new Response(req.headers.get("user-agent") ?? "", {
          headers: { "content-type": "text/plain" },
        });
      },
    });

    const result = await fetchUrl(`http://127.0.0.1:${server.port}`, 5000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toMatch(/^urlwatcher\//);
  });

  test("URLWATCHER_USER_AGENT env var overrides the default UA", async () => {
    process.env.URLWATCHER_USER_AGENT = "custom-agent/9.9";
    server = Bun.serve({
      port: 0,
      fetch(req) {
        return new Response(req.headers.get("user-agent") ?? "", {
          headers: { "content-type": "text/plain" },
        });
      },
    });

    const result = await fetchUrl(`http://127.0.0.1:${server.port}`, 5000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toBe("custom-agent/9.9");
  });
});

describe("detectContentType", () => {
  test("config override beats every header/body signal", () => {
    expect(detectContentType("text/html", "<html></html>", "json")).toBe("json");
    expect(detectContentType("application/json", "{}", "rss")).toBe("rss");
    expect(detectContentType("application/rss+xml", "<rss/>", "html")).toBe("html");
  });

  test("recognizes json header with charset", () => {
    expect(detectContentType("application/json; charset=utf-8")).toBe("json");
  });

  test("recognizes rss and atom headers", () => {
    expect(detectContentType("application/rss+xml")).toBe("rss");
    expect(detectContentType("application/atom+xml")).toBe("rss");
  });

  test("recognizes xml header + feed-like body", () => {
    expect(detectContentType("application/xml", '<?xml version="1.0"?><rss></rss>')).toBe("rss");
    expect(
      detectContentType(
        "text/xml",
        '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>'
      )
    ).toBe("rss");
  });

  test("xml header with non-feed body falls back to html", () => {
    expect(detectContentType("application/xml", "<root><child/></root>")).toBe("html");
  });

  test("falls back to body sniff when content-type missing", () => {
    expect(detectContentType("", "<rss version='2.0'></rss>")).toBe("rss");
    expect(detectContentType("", '<feed xmlns="http://www.w3.org/2005/Atom"></feed>')).toBe("rss");
  });

  test("defaults to html when no signal", () => {
    expect(detectContentType("")).toBe("html");
    expect(detectContentType("text/html", "<html></html>")).toBe("html");
  });
});
