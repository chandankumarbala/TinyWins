import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve(
  "src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Tiny Wins_1.0.0_aarch64.dmg",
);
const destination = resolve("TinyWins_1.0.0_aarch64.dmg");

if (!existsSync(source)) {
  throw new Error(`Expected DMG was not found: ${source}`);
}

copyFileSync(source, destination);
console.log(`Copied ${source} to ${destination}`);
