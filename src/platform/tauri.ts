import { invoke } from "@tauri-apps/api/core";
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { State } from "../domain";
import {
  createBackupEnvelope,
  mergeImportedState,
  normalizeImportedState,
  prepareNativeStateForLoad,
  parseBackupEnvelope,
} from "../backup";
import type { NativeSettings, PlatformBridge } from "./types";

const defaultSettings: NativeSettings = {
  themePreference: "system",
  alwaysOnTop: false,
};
const notificationTargets = new Map<
  number,
  { tabId: string; taskId: string }
>();
const notificationFocusCallbacks = new Set<
  (target: { tabId: string; taskId: string }) => void
>();
let listeningForNotifications = false;

function notificationId(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1)
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  return Math.abs(hash) || 1;
}

async function ensureNotificationListener() {
  if (listeningForNotifications) return;
  listeningForNotifications = true;
  await onAction((event) => {
    const id = event.notification?.id;
    if (id === undefined) return;
    const target = notificationTargets.get(id);
    if (!target) return;
    void invoke("show_main_window");
    notificationFocusCallbacks.forEach((callback) => callback(target));
  });
}

function parseSettings(raw: string | null): NativeSettings {
  if (!raw) return { ...defaultSettings };
  const parsed = JSON.parse(raw) as Partial<NativeSettings>;
  return {
    themePreference:
      parsed.themePreference === "light" ||
      parsed.themePreference === "dark" ||
      parsed.themePreference === "system"
        ? parsed.themePreference
        : "system",
    alwaysOnTop: parsed.alwaysOnTop === true,
  };
}

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function createTauriPlatform(): PlatformBridge {
  return {
    kind: "tauri",
    async loadState() {
      const raw = await invoke<string | null>("load_state_file");
      return raw ? prepareNativeStateForLoad(parseBackupEnvelope(raw)) : null;
    },
    async saveState(state: State) {
      await invoke("save_state_file", {
        content: JSON.stringify(createBackupEnvelope(state), null, 2),
      });
    },
    async exportState(state: State) {
      const path = await saveDialog({
        defaultPath: `tiny-wins-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path)
        await writeTextFile(
          path,
          JSON.stringify(createBackupEnvelope(state), null, 2),
        );
    },
    async importBackup() {
      const path = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      return typeof path === "string" ? readTextFile(path) : null;
    },
    async mergeImportedBackup(
      content: string,
      current: State,
      now = Date.now(),
    ) {
      return mergeImportedState(
        current,
        normalizeImportedState(parseBackupEnvelope(content)),
        now,
      );
    },
    async loadSettings() {
      return parseSettings(await invoke<string | null>("load_settings_file"));
    },
    async saveSettings(settings: NativeSettings) {
      await invoke("save_settings_file", {
        content: JSON.stringify(settings, null, 2),
      });
    },
    async setAlwaysOnTop(enabled: boolean) {
      await invoke("set_always_on_top", { enabled });
    },
    async notify(alert) {
      await ensureNotificationListener();
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (!granted) return;
      const id = notificationId(alert.id);
      notificationTargets.set(id, { tabId: alert.tabId, taskId: alert.taskId });
      sendNotification({
        id,
        title: alert.title,
        body: alert.body,
        autoCancel: true,
      });
    },
    onNotificationFocus(callback) {
      notificationFocusCallbacks.add(callback);
      return () => {
        notificationFocusCallbacks.delete(callback);
      };
    },
  };
}
