import type { State } from "../domain";
import {
  mergeImportedState,
  normalizeImportedState,
  parseBackupEnvelope,
} from "../backup";
import { exportBackup, load, save } from "../storage";
import type { NativeSettings, PlatformBridge } from "./types";

const browserSettings: NativeSettings = {
  themePreference: "light",
  alwaysOnTop: false,
};

export function createBrowserPlatform(): PlatformBridge {
  return {
    kind: "browser",
    async loadState() {
      return load();
    },
    async saveState(state: State) {
      save(state);
    },
    async exportState(state: State) {
      exportBackup(state);
    },
    async importBackup() {
      return null;
    },
    async mergeImportedBackup(
      content: string,
      current: State,
      now = Date.now(),
    ) {
      const imported = normalizeImportedState(parseBackupEnvelope(content));
      return mergeImportedState(current, imported, now);
    },
    async loadSettings() {
      const state = load();
      if (state) browserSettings.themePreference = state.theme;
      return { ...browserSettings };
    },
    async saveSettings(settings: NativeSettings) {
      browserSettings.themePreference = settings.themePreference;
      browserSettings.alwaysOnTop = settings.alwaysOnTop;
    },
    async setAlwaysOnTop() {
      return undefined;
    },
    async notify() {
      return undefined;
    },
    onNotificationFocus() {
      return () => undefined;
    },
  };
}
