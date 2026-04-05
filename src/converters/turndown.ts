import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { registerConverter } from "./registry.ts";
import type { ConverterPlugin } from "./types.ts";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

const turndownConverter: ConverterPlugin = {
  name: "turndown",
  description: "Converts HTML to Markdown locally using Turndown + Readability",
  supportedContentTypes: ["text/html"],
  handlesOwnFetching: false,

  async convert(_url, body, _contentType) {
    const { document } = parseHTML(body);
    const reader = new Readability(document);
    const article = reader.parse();

    const html = article ? article.content : document.body?.innerHTML ?? body;
    const content = turndown.turndown(html);

    return { content, extension: "md" };
  },
};

registerConverter(turndownConverter);
export default turndownConverter;
