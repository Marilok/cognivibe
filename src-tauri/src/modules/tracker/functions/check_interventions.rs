use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::modules::state::AppState;
use crate::modules::state::functions::focus_timer::schedule_tray_menu;

/// Cooldown between break nudges (45 minutes)
const BREAK_COOLDOWN_SECS: u64 = 45 * 60;

/// Cooldown between focus nudges (20 minutes)
const FOCUS_COOLDOWN_SECS: u64 = 20 * 60;

/// Maximum focus nudges per session
const MAX_FOCUS_NUDGES_PER_SESSION: u32 = 3;

/// Minimum session duration before focus nudge triggers (10 minutes)
const MIN_SESSION_FOR_FOCUS_SECS: u64 = 10 * 60;

/// Rolling window size for switching detection (5 minutes)
const SWITCHING_WINDOW_SIZE: usize = 5;

/// Number of consecutive inactive minutes to auto-pause break nudge
const INACTIVE_THRESHOLD_FOR_PAUSE: u32 = 3;

/// Payload emitted for break nudge events
#[derive(Debug, Clone, Serialize)]
pub struct BreakNudgePayload {
    pub trigger_reason: String,
    pub session_minutes: u32,
}

/// Payload emitted for focus nudge events
#[derive(Debug, Clone, Serialize)]
pub struct FocusNudgePayload {
    pub switching_count: u32,
    pub window_minutes: u32,
}

/// Check intervention triggers after each minute upload.
///
/// Handles:
/// - Break nudges (session duration >= threshold, high cognitive load)
/// - Focus nudges (context switching spike above personal baseline)
///
/// Called from `start_minute_logger` after successful data upload.
pub fn check_interventions(
    app_handle: &AppHandle,
    session_duration_secs: u64,
    is_active_minute: bool,
    window_change_count: u32,
    tab_change_count: u32,
) {
    let state = app_handle.state::<Mutex<AppState>>();

    // Update rolling switching windows and check triggers
    let (break_trigger, focus_trigger) = {
        let mut app_state = match state.lock() {
            Ok(s) => s,
            Err(_) => return,
        };

        // Update consecutive inactive minutes
        if is_active_minute {
            app_state.consecutive_inactive_minutes = 0;
        } else {
            app_state.consecutive_inactive_minutes += 1;
        }

        // Update rolling switching windows
        app_state.recent_window_changes.push(window_change_count);
        app_state.recent_tab_changes.push(tab_change_count);
        if app_state.recent_window_changes.len() > SWITCHING_WINDOW_SIZE {
            app_state.recent_window_changes.remove(0);
        }
        if app_state.recent_tab_changes.len() > SWITCHING_WINDOW_SIZE {
            app_state.recent_tab_changes.remove(0);
        }

        let break_trigger = check_break_trigger(&app_state, session_duration_secs);
        let focus_trigger = check_focus_trigger(&app_state, session_duration_secs);

        (break_trigger, focus_trigger)
    };

    // Emit break nudge event + system notification
    if let Some(reason) = break_trigger {
        let session_minutes = (session_duration_secs / 60) as u32;
        let payload = BreakNudgePayload {
            trigger_reason: reason.clone(),
            session_minutes,
        };

        #[cfg(debug_assertions)]
        println!(
            "[INTERVENTIONS] Emitting break-nudge: {:?}",
            payload
        );

        // Send system notification (visible over fullscreen apps)
        let notif_body = if reason == "high_cognitive_load" {
            "Your cognitive load has been elevated. Time for a break.".to_string()
        } else {
            format!("You've been working for {} minutes. Time for a break.", session_minutes)
        };
        if let Err(e) = app_handle
            .notification()
            .builder()
            .title("CogniVibe")
            .body(&notif_body)
            .show()
        {
            #[cfg(debug_assertions)]
            eprintln!("[INTERVENTIONS] Failed to send break notification: {}", e);
        }

        // Emit Tauri event so BreakManager spawns the popup window
        if let Err(e) = app_handle.emit("break-nudge", &payload) {
            #[cfg(debug_assertions)]
            eprintln!("[INTERVENTIONS] Failed to emit break-nudge: {}", e);
        }

        // Update cooldown and tray state
        if let Ok(mut app_state) = state.lock() {
            app_state.last_break_nudge_time = Some(Instant::now());
            app_state.sent_break_notification = true;
            app_state.break_nudge_active = true;
            app_state.break_nudge_end_time = Some(Instant::now() + Duration::from_secs(120));
        }
        schedule_tray_menu(app_handle);
    }

    // Emit focus nudge event + system notification
    if let Some(switching_count) = focus_trigger {
        let payload = FocusNudgePayload {
            switching_count,
            window_minutes: SWITCHING_WINDOW_SIZE as u32,
        };

        #[cfg(debug_assertions)]
        println!(
            "[INTERVENTIONS] Emitting focus-nudge: {:?}",
            payload
        );

        // Send system notification (visible over fullscreen apps)
        if let Err(e) = app_handle
            .notification()
            .builder()
            .title("CogniVibe")
            .body("Lots of context switching detected.")
            .show()
        {
            #[cfg(debug_assertions)]
            eprintln!("[INTERVENTIONS] Failed to send focus notification: {}", e);
        }

        // Emit Tauri event so BreakManager spawns the popup window
        if let Err(e) = app_handle.emit("focus-nudge", &payload) {
            #[cfg(debug_assertions)]
            eprintln!("[INTERVENTIONS] Failed to emit focus-nudge: {}", e);
        }

        // Update cooldown, counter, and tray state
        if let Ok(mut app_state) = state.lock() {
            app_state.last_focus_nudge_time = Some(Instant::now());
            app_state.focus_nudge_count_session += 1;
            app_state.focus_nudge_active = true;
        }
        schedule_tray_menu(app_handle);
    }
}

/// Check if a break nudge should be triggered.
/// Returns Some(reason) if triggered, None otherwise.
fn check_break_trigger(app_state: &AppState, session_duration_secs: u64) -> Option<String> {
    // Check if break nudges are enabled
    if !app_state.settings.break_nudge_enabled {
        return None;
    }

    // Check cooldown
    if let Some(last_time) = app_state.last_break_nudge_time {
        if last_time.elapsed().as_secs() < BREAK_COOLDOWN_SECS {
            return None;
        }
    }

    // Check if already sent this session
    if app_state.sent_break_notification {
        return None;
    }

    // Auto-pause: check if user is in an auto-pause category
    if let Some(ref category) = app_state.current_app_category {
        if app_state.settings.break_auto_pause_categories.contains(category) {
            #[cfg(debug_assertions)]
            println!(
                "[INTERVENTIONS] Break nudge deferred: user in auto-pause category '{}'",
                category
            );
            return None;
        }
    }

    // Auto-pause: user is already inactive (taking a break)
    if app_state.consecutive_inactive_minutes >= INACTIVE_THRESHOLD_FOR_PAUSE {
        return None;
    }

    // Trigger 1: Session duration >= break_interval_minutes
    let break_threshold_secs = (app_state.settings.break_interval_minutes as u64) * 60;
    if session_duration_secs >= break_threshold_secs {
        return Some("long_session".to_string());
    }

    // Trigger 2: Consecutive high cognitive load scores
    // The consecutive_high_score_count is updated in check_extreme_zscore.rs
    // using the score threshold from settings
    if app_state.consecutive_high_score_count >= 3 {
        return Some("high_cognitive_load".to_string());
    }

    None
}

/// Check if a focus nudge should be triggered.
/// Returns Some(switching_count) if triggered, None otherwise.
fn check_focus_trigger(app_state: &AppState, session_duration_secs: u64) -> Option<u32> {
    // Check if focus nudges are enabled
    if !app_state.settings.focus_nudge_enabled {
        return None;
    }

    // Minimum session duration
    if session_duration_secs < MIN_SESSION_FOR_FOCUS_SECS {
        return None;
    }

    // Max nudges per session
    if app_state.focus_nudge_count_session >= MAX_FOCUS_NUDGES_PER_SESSION {
        return None;
    }

    // Check cooldown
    if let Some(last_time) = app_state.last_focus_nudge_time {
        if last_time.elapsed().as_secs() < FOCUS_COOLDOWN_SECS {
            return None;
        }
    }

    // Don't nudge during Communication category (switching is expected)
    if let Some(ref category) = app_state.current_app_category {
        if category == "Communication" || category == "Meetings" {
            return None;
        }
    }

    // Need enough data in the rolling window
    if app_state.recent_window_changes.len() < SWITCHING_WINDOW_SIZE {
        return None;
    }

    // Calculate total switching in the window
    let total_window_switches: u32 = app_state.recent_window_changes.iter().sum();
    let total_tab_switches: u32 = app_state.recent_tab_changes.iter().sum();
    let total_switches = total_window_switches + total_tab_switches;

    // Compare against sensitivity threshold
    // The baseline change_mean is per-minute, so multiply by window size
    // Use a fallback baseline of 3 switches/min if no personal baseline is available
    let baseline_per_minute = 3.0; // Conservative fallback
    let threshold = (app_state.settings.focus_nudge_sensitivity * baseline_per_minute * SWITCHING_WINDOW_SIZE as f64) as u32;

    if total_switches > threshold && total_switches > 0 {
        #[cfg(debug_assertions)]
        println!(
            "[INTERVENTIONS] Focus nudge triggered: {} switches in {}min (threshold: {})",
            total_switches, SWITCHING_WINDOW_SIZE, threshold
        );
        return Some(total_switches);
    }

    None
}
