#!/usr/bin/env bun

const API_URL = "https://api.zo.computer/zo/ask";
const REQUEST_TIMEOUT_MS = 60_000;

function readFlag(name: string, required = false): string | undefined {
  const index = Bun.argv.indexOf(name);
  const value = index === -1 ? undefined : Bun.argv[index + 1];
  if (required && !value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readInput(): string {
  const flagsWithValues = new Set(["--model", "--output-format", "--conversation-id"]);
  const args = Bun.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (flagsWithValues.has(arg)) {
      i++;
      continue;
    }
    return arg;
  }
  throw new Error("input is required");
}

function parseObjectJson(value: string | undefined): unknown {
  if (!value) return undefined;
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON argument must be an object");
  }
  return parsed;
}

async function requestZo(payload: Record<string, unknown>, token: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        authorization: token,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const model = readFlag("--model", true)!;
  const input = readInput();
  const outputFormat = parseObjectJson(readFlag("--output-format"));
  const conversationId = readFlag("--conversation-id");
  const token = process.env.ZO_CLIENT_IDENTITY_TOKEN;

  if (!token) {
    throw new Error("ZO_CLIENT_IDENTITY_TOKEN environment variable is required");
  }

  const payload: Record<string, unknown> = {
    input,
    model_name: model,
  };
  if (conversationId) payload.conversation_id = conversationId;
  if (outputFormat) payload.output_format = outputFormat;

  const result = await requestZo(payload, token);
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
