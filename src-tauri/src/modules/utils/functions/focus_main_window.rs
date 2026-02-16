use tauri::{AppHandle, Manager};

#[cfg(debug_assertions)]
use crate::modules::utils::get_utils_prefix;

/// Brings the main application window to the foreground and ensures it's visible.
///
/// This function performs the following actions on the main window:
/// - Sets focus to the window (brings it to the front)
/// - Shows the window if it was hidden
/// - Unminimizes the window if it was minimized
///
/// This is commonly used when the app is activated through deep links or
/// single-instance enforcement to ensure the user can see and interact with the app.
///
/// # Arguments
/// * `app` - Reference to the Tauri app handle for accessing windows
pub fn focus_main_window_impl(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(debug_assertions)]
        println!("{}Focusing main window", get_utils_prefix());

        let _ = window.set_focus();
        let _ = window.show();
        let _ = window.unminimize();
    } else {
        #[cfg(debug_assertions)]
        println!("{}Main window not found", get_utils_prefix());
        return;
    }
}

/// Tauri command to focus the main window. Callable from the frontend via invoke("focus_main_window").
#[tauri::command]
pub fn focus_main_window(app: AppHandle) {
    focus_main_window_impl(&app);
}
