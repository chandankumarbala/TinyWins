import type { State } from "../domain";

export type ThemePreference = "system" | "light" | "dark";

export interface NativeSettings {
  themePreference: ThemePreference;
  alwaysOnTop: boolean;
}

export interface AlertNotification {
  id: string;
  tabId: string;
  taskId: string;
  title: string;
  body: string;
}

export interface PlatformBridge {
  kind: "browser" | "tauri";
  loadState(): Promise<State | null>;
  saveState(state: State): Promise<void>;
  exportState(state: State): Promise<void>;
  importBackup(): Promise<string | null>;
  mergeImportedBackup(
    content: string,
    current: State,
    now?: number,
  ): Promise<State>;
  loadSettings(): Promise<NativeSettings>;
  saveSettings(settings: NativeSettings): Promise<void>;
  setAlwaysOnTop(enabled: boolean): Promise<void>;
  notify(alert: AlertNotification): Promise<void>;
  onNotificationFocus(
    callback: (target: { tabId: string; taskId: string }) => void,
  ): () => void;
}
