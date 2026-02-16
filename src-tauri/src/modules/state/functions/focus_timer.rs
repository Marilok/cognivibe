use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::modules::state::AppState;
use crate::modules::state::functions::tray_menu;

/// Minimum ms between tray updates to avoid races when user clicks tray (macOS).
const TRAY_UPDATE_THROTTLE_MS: u64 = 500;
static LAST_TRAY_UPDATE: AtomicU64 = AtomicU64::new(0);

/// Run closure on main thread (macOS) — NSStatusItem requires main thread.
#[cfg(target_os = "macos")]
fn run_tray_on_main<F>(app_handle: &AppHandle, f: F)
where
    F: FnOnce(&AppHandle) + Send + 'static,
{
    let handle = app_handle.clone();
    let _ = app_handle.run_on_main_thread(move || f(&handle));
}

#[cfg(not(target_os = "macos"))]
fn run_tray_on_main<F>(app_handle: &AppHandle, f: F)
where
    F: FnOnce(&AppHandle),
{
    f(app_handle);
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Throttle: skip if we updated recently (avoids updating while menu is shown).
fn should_throttle() -> bool {
    let now = now_ms();
    let last = LAST_TRAY_UPDATE.load(Ordering::Relaxed);
    now.saturating_sub(last) < TRAY_UPDATE_THROTTLE_MS
}

/// Response type for focus session state queries
#[derive(Debug, Clone, Serialize)]
pub struct FocusSessionState {
    pub remaining_secs: u64,
    pub total_secs: u64,
}

/// Start a focus session with the given duration.
/// The unified tray loop handles display updates.
#[tauri::command]
pub fn start_focus_session(app_handle: AppHandle, duration_secs: u64) -> Result<(), String> {
    let state = app_handle.state::<Mutex<AppState>>();
    let end_time = SystemTime::now() + Duration::from_secs(duration_secs);

    {
        let mut app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        app_state.focus_session_active = true;
        app_state.focus_session_end_time = Some(end_time);
        app_state.focus_session_total_secs = Some(duration_secs);
    }

    // Immediate tray update (unified loop will take over within 2s)
    schedule_tray_update(&app_handle);

    #[cfg(debug_assertions)]
    println!("[FOCUS_TIMER] Focus session started: {}s", duration_secs);

    Ok(())
}

/// Get the current focus session state.
/// Returns None if no focus session is active.
#[tauri::command]
pub fn get_focus_session_state(app_handle: AppHandle) -> Result<Option<FocusSessionState>, String> {
    let state = app_handle.state::<Mutex<AppState>>();
    let app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    if !app_state.focus_session_active {
        return Ok(None);
    }

    let remaining = match app_state.focus_session_end_time {
        Some(end) => {
            let now = SystemTime::now();
            if now >= end {
                0
            } else {
                end.duration_since(now).unwrap_or_default().as_secs()
            }
        }
        None => return Ok(None),
    };

    // Calculate total from end_time - (end_time - remaining)
    // We don't store total, so approximate from the focus_session_end_time
    Ok(Some(FocusSessionState {
        remaining_secs: remaining,
        total_secs: remaining, // approximation, doesn't need to be exact
    }))
}

/// Extend the current focus session by the given number of seconds.
#[tauri::command]
pub fn extend_focus_session(app_handle: AppHandle, extra_secs: u64) -> Result<(), String> {
    {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

        if !app_state.focus_session_active {
            return Err("No focus session active".to_string());
        }

        if let Some(ref mut end_time) = app_state.focus_session_end_time {
            let new_end = *end_time + Duration::from_secs(extra_secs);
            *end_time = new_end;
        }
    }

    schedule_tray_menu(&app_handle);

    #[cfg(debug_assertions)]
    println!("[FOCUS_TIMER] Focus session extended by {}s", extra_secs);

    Ok(())
}

/// Stop the current focus session.
#[tauri::command]
pub fn stop_focus_session(app_handle: AppHandle) -> Result<(), String> {
    {
        let state = app_handle.state::<Mutex<AppState>>();
        let mut app_state = state.lock().map_err(|e| format!("Lock error: {}", e))?;

        app_state.focus_session_active = false;
        app_state.focus_session_end_time = None;
        app_state.focus_session_total_secs = None;
    }

    schedule_tray_update(&app_handle);

    #[cfg(debug_assertions)]
    println!("[FOCUS_TIMER] Focus session stopped");

    Ok(())
}

/// Update tray from current AppState. Priority: Focus > Break > Break Nudge > Focus Nudge > CL > clear.
/// Runs tray updates on main thread for reliable macOS NSStatusItem.
pub fn update_tray_from_state(app_handle: &AppHandle) {
    let (title, tooltip) = {
        let state = app_handle.state::<Mutex<AppState>>();
        let app_state = match state.lock() {
            Ok(s) => s,
            Err(_) => return,
        };

        let now_sys = SystemTime::now();
        let now_inst = Instant::now();

        // 1. Focus session
        if app_state.focus_session_active {
            if let Some(end) = app_state.focus_session_end_time {
                if now_sys >= end {
                    let total = app_state.focus_session_total_secs.unwrap_or(0);
                    drop(app_state);
                    {
                        let state = app_handle.state::<Mutex<AppState>>();
                        if let Ok(mut s) = state.lock() {
                            s.focus_session_active = false;
                            s.focus_session_end_time = None;
                            s.focus_session_total_secs = None;
                        };
                    }
                    let _ = app_handle.emit("focus-session-complete", total);
                    tray_menu::update_tray_menu(app_handle);
                    #[cfg(debug_assertions)]
                    println!("[TRAY] Focus session complete, emitted");
                    return update_tray_from_state(app_handle);
                }
                let remaining = end.duration_since(now_sys).unwrap_or_default().as_secs();
                let m = remaining / 60;
                let s = remaining % 60;
                let t = format!("{}:{:02}", m, s);
                return apply_tray(app_handle, Some(&t), &format!("Focus: {}", t));
            }
        }

        // 2. Break session
        if app_state.break_session_active {
            if let Some(end) = app_state.break_session_end_time {
                let remaining = if now_sys >= end { 0 } else { end.duration_since(now_sys).unwrap_or_default().as_secs() };
                let m = remaining / 60;
                let s = remaining % 60;
                let t = format!("{}:{:02}", m, s);
                return apply_tray(app_handle, Some(&t), &format!("Break: {}", t));
            }
        }

        // 3. Break nudge
        if app_state.break_nudge_active {
            if let Some(end) = app_state.break_nudge_end_time {
                let remaining = if now_inst >= end { 0 } else { end.duration_since(now_inst).as_secs() };
                if remaining == 0 {
                    drop(app_state);
                    {
                        let state = app_handle.state::<Mutex<AppState>>();
                        if let Ok(mut s) = state.lock() {
                            s.break_nudge_active = false;
                            s.break_nudge_end_time = None;
                        };
                    }
                    tray_menu::update_tray_menu(app_handle);
                    return update_tray_from_state(app_handle);
                }
                let m = remaining / 60;
                let s = remaining % 60;
                let t = format!("{}:{:02}", m, s);
                return apply_tray(app_handle, Some(&format!("Break in {}", t)), &format!("Time for a break in {}", t));
            }
        }

        // 4. Focus nudge
        if app_state.focus_nudge_active {
            return apply_tray(app_handle, Some("Focus?"), "Start a focus session?");
        }

        // 5. Cognitive load
        if let Some(cl) = app_state.last_cognitive_load {
            let t = format!("{}", cl.round() as i64);
            return apply_tray(app_handle, Some(&t), &format!("Cognitive load: {}", cl.round() as i64));
        }

        // 6. Clear (no title text, just icon)
        (String::new(), "CogniVibe".to_string())
    };

    // Empty string means clear the title; apply_tray handles this
    let title_opt = if title.is_empty() { None } else { Some(title.as_str()) };
    apply_tray(app_handle, title_opt, &tooltip);
}

fn apply_tray(app_handle: &AppHandle, title: Option<&str>, tooltip: &str) {
    if let Some(tray) = find_tray(app_handle) {
        #[cfg(target_os = "macos")]
        {
            // Use Some("") instead of None to reliably clear on macOS
            let title_val = title.unwrap_or("");
            let _ = tray.set_title(Some(title_val));
        }
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

/// Schedule both title and menu update. Use for state changes.
pub fn schedule_tray_update(app_handle: &AppHandle) {
    run_tray_on_main(app_handle, |h| {
        LAST_TRAY_UPDATE.store(now_ms(), Ordering::Relaxed);
        update_tray_from_state(h);
        tray_menu::update_tray_menu(h);
    });
}

/// Schedule menu-only update. Use when only menu structure changes.
pub fn schedule_tray_menu(app_handle: &AppHandle) {
    run_tray_on_main(app_handle, |h| {
        LAST_TRAY_UPDATE.store(now_ms(), Ordering::Relaxed);
        tray_menu::update_tray_menu(h);
    });
}

/// Spawn the unified tray update loop. Call once at app startup.
/// Uses main thread on macOS and 2s interval to reduce race with tray clicks.
pub fn spawn_tray_update_loop(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let _ = tauri::async_runtime::spawn_blocking(|| {
                std::thread::sleep(Duration::from_secs(2));
            })
            .await;
            if should_throttle() {
                continue;
            }
            run_tray_on_main(&app_handle, |h| {
                LAST_TRAY_UPDATE.store(now_ms(), Ordering::Relaxed);
                update_tray_from_state(h);
            });
        }
    });
}

/// Helper to try to find a tray icon
fn find_tray(app_handle: &AppHandle) -> Option<tauri::tray::TrayIcon> {
    for id in ["main", "tray", "1", "0"] {
        if let Some(tray) = app_handle.tray_by_id(id) {
            return Some(tray);
        }
    }
    #[cfg(debug_assertions)]
    eprintln!("[FOCUS_TIMER] find_tray: tried all IDs, none found");
    None
}
