import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ROUTES } from "./constants";

const SETTINGS_WINDOW_LABEL = "settings";

export async function openSettingsWindow(): Promise<void> {
  try {
    const existing = await WebviewWindow.getByLabel(SETTINGS_WINDOW_LABEL);
    if (existing) {
      await existing.setFocus();
      return;
    }
  } catch {
    // Window doesn't exist, create it
  }

  const settingsWindow = new WebviewWindow(SETTINGS_WINDOW_LABEL, {
    url: ROUTES.SETTINGS,
    title: "Settings",
    width: 860,
    height: 560,
    center: true,
    resizable: true,
    decorations: true,
    transparent: false,
    focus: true,
  });

  settingsWindow.once("tauri://error", (e) => {
    console.error("[SETTINGS] Failed to create settings window:", e);
  });
}
