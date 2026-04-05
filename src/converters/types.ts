export interface ConvertResult {
  content: string;
  extension: "md" | "yaml";
}

export interface ConverterPlugin {
  name: string;
  description: string;
  supportedContentTypes: string[];
  handlesOwnFetching: boolean;
  convert(url: string, body: string, contentType: string): Promise<ConvertResult>;
}
