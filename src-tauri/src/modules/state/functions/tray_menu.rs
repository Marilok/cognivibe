use std::sync::Mutex;

use tauri::{AppHandle, Manager};

use crate::modules::state::AppState;

/// Build the tray menu based on current AppState.
pub fn build_tray_menu<R: tauri::Runtime>(app_handle: &AppHandle<R>) -> Result<tauri::menu::Menu<R>, String> {
    let state = app_handle.state::<Mutex<AppState>>();
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut builder = tauri::menu::MenuBuilder::new(app_handle)
        .text("show", "Show CogniVibe")
        .separator();

    if app_state.focus_session_active {
        builder = builder
            .text("add_5_min", "Add 5 minutes")
            .text("skip_to_break", "Skip to break")
            .text("cancel_focus", "Cancel Pomodoro")
            .separator();
    }

    if app_state.break_session_active {
        builder = builder
            .text("add_1_min_break", "Add 1 minute")
            .text("skip_break", "Skip break")
            .separator();
    }

    if app_state.break_nudge_active {
        builder = builder
            .text("prolong_nudge", "Prolong countdown (+2 min)")
            .text("start_nudge", "Start now")
            .text("dismiss_nudge", "Skip")
            .separator();
    }

    if app_state.focus_nudge_active {
        builder = builder
            .text("start_focus", "Start Focus")
            .text("dismiss_focus", "Dismiss")
            .separator();
    }

    builder = builder.text("quit", "Quit");

    builder.build().map_err(|e| e.to_string())
}

/// Update the tray menu from current state. Call whenever focus/break/nudge state changes.
pub fn update_tray_menu(app_handle: &AppHandle) {
    let tray = find_tray(app_handle);
    let menu = match build_tray_menu(app_handle) {
        Ok(m) => m,
        Err(_) => return,
    };
    if let Some(t) = tray {
        let _ = t.set_menu(Some(menu));
    }
}

fn find_tray(app_handle: &AppHandle) -> Option<tauri::tray::TrayIcon> {
    for id in ["main", "tray", "1", "0"] {
        if let Some(tray) = app_handle.tray_by_id(id) {
            return Some(tray);
        }
    }
    None
}
