use std::sync::Mutex;
use std::time::{Duration, SystemTime};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::modules::state::AppState;
use crate::modules::state::functions::focus_timer::{schedule_tray_menu, schedule_tray_update};

/// Start a break session (called when break overlay spawns).
/// Clears break nudge state since the nudge is consumed.
#[tauri::command]
pub fn start_break_session(app_handle: AppHandle, duration_secs: u64) -> Result<(), String> {
    let state = app_handle.state::<Mutex<AppState>>();
    let end_time = SystemTime::now() + Duration::from_secs(duration_secs);

    {
        let mut app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        app_state.break_session_active = true;
        app_state.break_session_end_time = Some(end_time);
        app_state.break_nudge_active = false;
        app_state.break_nudge_end_time = None;
    }

    schedule_tray_update(&app_handle);

    #[cfg(debug_assertions)]
    println!("[TRAY] Break session started: {}s", duration_secs);

    Ok(())
}

/// End the current break session (called when break completes or is skipped).
#[tauri::command]
pub fn end_break_session(app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Mutex<AppState>>();

    {
        let mut app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        app_state.break_session_active = false;
        app_state.break_session_end_time = None;
    }

    schedule_tray_update(&app_handle);

    #[cfg(debug_assertions)]
    println!("[TRAY] Break session ended");

    Ok(())
}

/// Extend the current break session by the given number of seconds.
#[tauri::command]
pub fn extend_break_session(app_handle: AppHandle, extra_secs: u64) -> Result<(), String> {
    {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

        if !app_state.break_session_active {
            return Err("No break session active".to_string());
        }

        if let Some(ref mut end_time) = app_state.break_session_end_time {
            let new_end = *end_time + Duration::from_secs(extra_secs);
            *end_time = new_end;
        }
    }

    schedule_tray_menu(&app_handle);

    #[derive(Clone, Serialize)]
    struct BreakExtendedPayload {
        extra_secs: u64,
    }
    let _ = app_handle.emit("break-extended", BreakExtendedPayload { extra_secs });

    #[cfg(debug_assertions)]
    println!("[TRAY] Break session extended by {}s", extra_secs);

    Ok(())
}

/// Prolong the break nudge countdown by the given seconds (+2 min = 120).
#[tauri::command]
pub fn extend_break_nudge(app_handle: AppHandle, extra_secs: u64) -> Result<(), String> {
    {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

        if !app_state.break_nudge_active {
            return Err("No break nudge active".to_string());
        }

        if let Some(ref mut end_time) = app_state.break_nudge_end_time {
            *end_time += Duration::from_secs(extra_secs);
        }
    }

    schedule_tray_menu(&app_handle);

    #[cfg(debug_assertions)]
    println!("[TRAY] Break nudge extended by {}s", extra_secs);

    Ok(())
}

/// Dismiss the break nudge (Start now / Skip).
#[tauri::command]
pub fn dismiss_break_nudge(app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Mutex<AppState>>();

    {
        let mut app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        app_state.break_nudge_active = false;
        app_state.break_nudge_end_time = None;
    }

    schedule_tray_update(&app_handle);

    #[cfg(debug_assertions)]
    println!("[TRAY] Break nudge dismissed");

    Ok(())
}

/// Dismiss the focus nudge (Start Focus / Dismiss).
#[tauri::command]
pub fn dismiss_focus_nudge(app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Mutex<AppState>>();

    {
        let mut app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        app_state.focus_nudge_active = false;
    }

    schedule_tray_update(&app_handle);

    #[cfg(debug_assertions)]
    println!("[TRAY] Focus nudge dismissed");

    Ok(())
}
