import { z } from "zod/v4";

const UrlEntrySchema = z.object({
  alias: z
    .string()
    .regex(/^[a-zA-Z0-9\-_]+$/, "Alias must be alphanumeric with hyphens/underscores"),
  url: z.url(),
  htmlConverter: z.string().optional(),
  jsonConverter: z.string().optional(),
  contentType: z.enum(["html", "json"]).optional(),
  timeout: z.number().positive().optional(),
});

const NotificationEntrySchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

const ConfigSchema = z.object({
  dataDir: z.string(),
  defaults: z
    .object({
      htmlConverter: z.string().default("turndown"),
      jsonConverter: z.string().default("yaml"),
      timeout: z.number().positive().default(30000),
    })
    .default({}),
  urls: z.array(UrlEntrySchema).default([]),
  notifications: z
    .array(NotificationEntrySchema)
    .default([{ type: "stdout" }]),
});

export type Config = z.infer<typeof ConfigSchema>;
export type UrlEntry = z.infer<typeof UrlEntrySchema>;
export { ConfigSchema, UrlEntrySchema };
