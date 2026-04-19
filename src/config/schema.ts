import { z } from "zod/v4";

const WatcherFrontMatterSchema = z.object({
  url: z.url(),
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
  dataDir: z.string(),
  watchDir: z.string().default("./watchers"),
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
export type WatcherFrontMatter = z.infer<typeof WatcherFrontMatterSchema>;

export interface Watcher extends WatcherFrontMatter {
  alias: string;
  body: string;
  filePath: string;
}

export { ConfigSchema, WatcherFrontMatterSchema };
