import { registerConverter } from "./registry.ts";
import type { ConverterPlugin } from "./types.ts";

const JINA_BASE = "https://r.jina.ai/";

const jinaConverter: ConverterPlugin = {
  name: "jina",
  description: "Converts HTML to Markdown via Jina Reader API (handles JS-rendered pages)",
  supportedContentTypes: ["text/html"],
  handlesOwnFetching: true,

  async convert(url, _body, _contentType, options) {
    const controller = new AbortController();
    const timeout = options?.timeout ?? 30000;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${JINA_BASE}${url}`, {
        headers: { Accept: "text/markdown" },
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new Error("Jina Reader rate limit exceeded (429)");
      }

      if (!response.ok) {
        throw new Error(`Jina Reader returned ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      return { content, extension: "md" };
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`Jina Reader timeout after ${timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
};

registerConverter(jinaConverter);
export default jinaConverter;
