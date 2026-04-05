import type { ConverterPlugin } from "./types.ts";

const converters = new Map<string, ConverterPlugin>();

export function registerConverter(converter: ConverterPlugin): void {
  converters.set(converter.name, converter);
}

export function getConverter(name: string): ConverterPlugin {
  const converter = converters.get(name);
  if (!converter) {
    const available = Array.from(converters.keys()).join(", ");
    throw new Error(`Unknown converter "${name}". Available: ${available}`);
  }
  return converter;
}

export function listConverters(): ConverterPlugin[] {
  return Array.from(converters.values());
}
