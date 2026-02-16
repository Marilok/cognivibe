/// Opens the system notification settings.
/// - macOS: System Settings > Notifications
/// - Windows: Settings > Notifications
/// - Linux: Attempts gnome-control-center or xdg-open (may not open notifications directly)
#[tauri::command]
pub fn open_notification_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.notifications")
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "ms-settings:notifications"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try gnome-control-center first (GNOME), then xdg-open as fallback
        let result = std::process::Command::new("gnome-control-center")
            .arg("notifications")
            .spawn();

        if result.is_err() {
            let _ = std::process::Command::new("xdg-open")
                .arg("settings://notification")
                .spawn();
        }
    }

    Ok(())
}
