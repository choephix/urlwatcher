import { afterEach, describe, expect, test } from "bun:test";
import { fetchUrl } from "./fetcher.ts";

let server: ReturnType<typeof Bun.serve> | undefined;

afterEach(() => {
  server?.stop(true);
  server = undefined;
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
});
