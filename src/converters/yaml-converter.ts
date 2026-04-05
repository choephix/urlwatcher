import { stringify } from "yaml";
import { registerConverter } from "./registry.ts";
import type { ConverterPlugin } from "./types.ts";

const yamlConverter: ConverterPlugin = {
  name: "yaml",
  description: "Converts JSON API responses to sorted YAML for clean diffs",
  supportedContentTypes: ["application/json"],
  handlesOwnFetching: false,

  async convert(_url, body, _contentType) {
    const data = JSON.parse(body);
    const content = stringify(data, { sortMapEntries: true, lineWidth: 120 });
    return { content, extension: "yaml" };
  },
};

registerConverter(yamlConverter);
export default yamlConverter;
