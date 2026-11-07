import type { NativeSettings, ThemePreference } from "./platform/types";

export function SettingsPanel({
  settings,
  nativeControls,
  onSettings,
  onImport,
  onExport,
  onClose,
}: {
  settings: NativeSettings;
  nativeControls: boolean;
  onSettings: (settings: NativeSettings) => void;
  onImport: () => void;
  onExport: () => void;
  onClose: () => void;
}) {
  const updateTheme = (themePreference: ThemePreference) =>
    onSettings({ ...settings, themePreference });
  const updateAlwaysOnTop = (alwaysOnTop: boolean) =>
    onSettings({ ...settings, alwaysOnTop });

  return (
    <section className="settings-panel" aria-label="Settings panel">
      <header>
        <h2>Settings</h2>
        <button type="button" onClick={onClose} aria-label="Close settings">
          x
        </button>
      </header>
      <label>
        <span>Theme</span>
        <select
          aria-label="Theme preference"
          value={settings.themePreference}
          onChange={(event) =>
            updateTheme(event.currentTarget.value as ThemePreference)
          }
        >
          {nativeControls && <option value="system">System</option>}
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>
        <span>Always on top</span>
        <input
          aria-label="Always on top"
          type="checkbox"
          checked={settings.alwaysOnTop}
          disabled={!nativeControls}
          onChange={(event) => updateAlwaysOnTop(event.currentTarget.checked)}
        />
      </label>
      <div className="settings-actions">
        <button type="button" onClick={onExport}>
          Export
        </button>
        <button type="button" onClick={onImport}>
          Import
        </button>
      </div>
    </section>
  );
}
