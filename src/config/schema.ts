import { z } from "zod/v4";

const SpecFrontMatterSchema = z.object({
  url: z.url(),
  enabled: z.boolean().default(true),
  htmlConverter: z.string().optional(),
  jsonConverter: z.string().optional(),
  rssConverter: z.string().optional(),
  contentType: z.enum(["html", "json", "rss"]).optional(),
  timeout: z.number().positive().optional(),
});

const NotificationEntrySchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

const ConfigSchema = z.object({
  snapshotDir: z.string(),
  specDir: z.string().default("./targets"),
  onChange: z.string().optional(),
  defaults: z
    .object({
      htmlConverter: z.string().default("turndown"),
      jsonConverter: z.string().default("yaml"),
      rssConverter: z.string().default("rss"),
      timeout: z.number().positive().default(30000),
    })
    .default({
      htmlConverter: "turndown",
      jsonConverter: "yaml",
      rssConverter: "rss",
      timeout: 30000,
    }),
  notifications: z
    .array(NotificationEntrySchema)
    .default([{ type: "stdout" }]),
});

export type Config = z.infer<typeof ConfigSchema>;
export type SpecFrontMatterInput = z.input<typeof SpecFrontMatterSchema>;
export type SpecFrontMatter = z.infer<typeof SpecFrontMatterSchema>;

export interface TargetSpec extends SpecFrontMatter {
  alias: string;
  body: string;
  filePath: string;
}

export { ConfigSchema, SpecFrontMatterSchema };
