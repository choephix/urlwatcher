export type FetchResult = {
  ok: true;
  body: string;
  contentType: string;
} | {
  ok: false;
  error: string;
}

export interface CheckResult {
  alias: string;
  url: string;
  changed: boolean;
  isNew?: boolean;
  diff?: string;
  error?: string;
  extension?: string;
  body?: string;
}
