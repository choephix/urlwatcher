import { createInterface } from "node:readline/promises";

export type AskFn = (question: string) => Promise<string>;

async function readLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

export async function promptText(
  question: string,
  defaultValue = "",
  ask: AskFn = readLine
): Promise<string> {
  if (!process.stdin.isTTY && ask === readLine) return defaultValue;

  const suffix = defaultValue === "" ? ": " : ` [${defaultValue}]: `;
  const answer = (await ask(question + suffix)).trim();
  return answer === "" ? defaultValue : answer;
}

export async function confirm(
  question: string,
  defaultYes = false,
  ask: AskFn = readLine
): Promise<boolean> {
  if (!process.stdin.isTTY && ask === readLine) return false;

  const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
  const answer = (await ask(question + suffix)).trim().toLowerCase();
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
}
