import { registerConverter } from "./registry.ts";
import type { ConverterPlugin } from "./types.ts";

const JINA_BASE = "https://r.jina.ai/";

const jinaConverter: ConverterPlugin = {
  name: "jina",
  description: "Converts HTML to Markdown via Jina Reader API (handles JS-rendered pages)",
  supportedContentTypes: ["text/html"],
  handlesOwnFetching: true,

  async convert(url, _body, _contentType) {
    const response = await fetch(`${JINA_BASE}${url}`, {
      headers: { Accept: "text/markdown" },
    });

    if (response.status === 429) {
      throw new Error("Jina Reader rate limit exceeded (429)");
    }

    if (!response.ok) {
      throw new Error(`Jina Reader returned ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    return { content, extension: "md" };
  },
};

registerConverter(jinaConverter);
export default jinaConverter;
