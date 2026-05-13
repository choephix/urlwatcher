import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureConfigForInit, loadConfig } from "./loader.ts";

describe("ensureConfigForInit", () => {
  test("creates a missing config using defaults when prompts are blank", async () => {
    const dir = mkdtempSync(join(tmpdir(), "urlwatcher-config-"));

    try {
      const configPath = join(dir, "urlwatcher.yaml");
      const answers = ["", "", "", "", ""];
      const { config, created } = await ensureConfigForInit(
        configPath,
        async () => answers.shift() ?? ""
      );

      expect(created).toBe(true);
      expect(existsSync(configPath)).toBe(true);

      const raw = readFileSync(configPath, "utf8");
      expect(raw).toContain("snapshotDir: ./snapshot");
      expect(raw).toContain("specDir: ./targets");
      expect(raw).toContain("timeout: 30000");
      expect(raw).not.toContain("onChange:");
      expect(raw).not.toContain("type: file");

      expect(config.snapshotDir).toBe(join(dir, "snapshot"));
      expect(config.specDir).toBe(join(dir, "targets"));
      expect(config.notifications).toEqual([{ type: "stdout" }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("writes optional onChange and file notifier fields when provided", async () => {
    const dir = mkdtempSync(join(tmpdir(), "urlwatcher-config-"));

    try {
      const configPath = join(dir, "urlwatcher.yaml");
      const answers = [
        "./snapshots",
        "./targets",
        "45000",
        "my-agent --diff {{diff}} --instructions {{body}}",
        "./runs.log",
      ];

      const { config, created } = await ensureConfigForInit(
        configPath,
        async () => answers.shift() ?? ""
      );

      expect(created).toBe(true);

      const raw = readFileSync(configPath, "utf8");
      expect(raw).toContain("snapshotDir: ./snapshots");
      expect(raw).toContain("specDir: ./targets");
      expect(raw).toContain("timeout: 45000");
      expect(raw).toContain("onChange: my-agent --diff {{diff}} --instructions {{body}}");
      expect(raw).toContain("- type: stdout");
      expect(raw).toContain("- type: file");
      expect(raw).toContain("path: ./runs.log");

      expect(config.snapshotDir).toBe(join(dir, "snapshots"));
      expect(config.specDir).toBe(join(dir, "targets"));
      expect(config.notifications).toEqual([
        { type: "stdout" },
        { type: "file", path: join(dir, "runs.log") },
      ]);
      expect(config.onChange).toBe("my-agent --diff {{diff}} --instructions {{body}}");
      expect(config.defaults.timeout).toBe(45000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("uses an existing config file without prompting", async () => {
    const dir = mkdtempSync(join(tmpdir(), "urlwatcher-config-"));

    try {
      const configPath = join(dir, "urlwatcher.yaml");
      await Bun.write(
        configPath,
        [
          "snapshotDir: ./existing-snapshots",
          "specDir: ./existing-targets",
          "defaults:",
          "  timeout: 12345",
        ].join("\n") + "\n"
      );

      let prompted = false;
      const { config, created } = await ensureConfigForInit(configPath, async () => {
        prompted = true;
        return "should not be used";
      });

      expect(created).toBe(false);
      expect(prompted).toBe(false);
      expect(config.snapshotDir).toBe(join(dir, "existing-snapshots"));
      expect(config.specDir).toBe(join(dir, "existing-targets"));
      expect(config.defaults.timeout).toBe(12345);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("loads legacy dataDir and watchDir config fields", async () => {
    const dir = mkdtempSync(join(tmpdir(), "urlwatcher-config-"));
    try {
      const configPath = join(dir, "urlwatcher.yaml");
      await Bun.write(
        configPath,
        [
          "dataDir: ./legacy-snapshot",
          "watchDir: ./legacy-targets",
          "defaults:",
          "  timeout: 12345",
        ].join("\n") + "\n"
      );

      const { config } = await loadConfig(configPath);

      expect(config.snapshotDir).toBe(join(dir, "legacy-snapshot"));
      expect(config.specDir).toBe(join(dir, "legacy-targets"));
      expect(config.defaults.timeout).toBe(12345);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
