import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { initialState } from "../src/domain";
import { createBackupEnvelope, parseBackupEnvelope } from "../src/backup";

describe("native data file shape", () => {
  it("uses the same envelope format for native app data and exported backups", () => {
    const envelope = createBackupEnvelope(initialState(), 123);
    const parsed = parseBackupEnvelope(JSON.stringify(envelope));

    expect(parsed).toEqual(envelope);
    expect(parsed.state.version).toBe(1);
  });
});

describe("native dev configuration", () => {
  it("starts the web app and local AI helper together for Tauri dev", () => {
    const config = JSON.parse(
      readFileSync("src-tauri/tauri.conf.json", "utf8"),
    ) as { build?: { beforeDevCommand?: string; devUrl?: string } };

    expect(config.build?.devUrl).toBe("http://127.0.0.1:5173");
    expect(config.build?.beforeDevCommand).toBe("npm run dev");
  });
});

describe("native package scripts", () => {
  it("exposes an Apple Silicon macOS DMG build command that copies the root installer", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["tauri:build:mac:apple-silicon"]).toBe(
      "tauri build --target aarch64-apple-darwin --bundles dmg && tsx scripts/copy-mac-dmg.ts",
    );
  });
});

describe("native installer copy script", () => {
  it("maps the Tauri DMG name to the root installer name without renaming the app", () => {
    const source = readFileSync("scripts/copy-mac-dmg.ts", "utf8");

    expect(source).toContain("Tiny Wins_1.0.0_aarch64.dmg");
    expect(source).toContain("TinyWins_1.0.0_aarch64.dmg");
    expect(source).toContain("copyFileSync");
  });
});

describe("native window sizing", () => {
  it("opens as a fixed-width right panel instead of a monitor percentage", () => {
    const source = readFileSync("src-tauri/src/lib.rs", "utf8");

    expect(source).toContain("const RIGHT_PANEL_WIDTH: f64 = 440.0;");
    expect(source).toContain("let width = RIGHT_PANEL_WIDTH;");
    expect(source).not.toContain("size.width as f64 * 0.25");
  });
});
