export async function confirm(question: string, defaultYes = false): Promise<boolean> {
  if (!process.stdin.isTTY) return false;

  const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
  process.stdout.write(question + suffix);

  for await (const line of console) {
    const answer = line.trim().toLowerCase();
    if (answer === "") return defaultYes;
    return answer === "y" || answer === "yes";
  }
  return false;
}
