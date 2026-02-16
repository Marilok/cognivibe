use crate::modules::settings::AppSettings;
use crate::modules::tracker::{KeyboardData, MouseData};
use serde::{Deserialize, Serialize};
use std::time::{Instant, SystemTime};

/// Session data received from the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
}

/// Application state to track measuring status and store runtime data
#[derive(Debug, Default)]
pub struct AppState {
    /// Whether input tracking/measuring is currently active
    pub is_measuring: bool,
    /// Whether this is the first minute of measurement (to ignore half-minute data)
    pub is_first_minute: bool,
    /// Application settings and user preferences
    pub settings: AppSettings,
    /// Mouse tracking data (clicks, movement distance, etc.)
    pub mouse_data: MouseData,
    /// Keyboard tracking data (key presses, releases, etc.)
    pub keyboard_data: KeyboardData,
    /// Currently active window ID
    pub active_window_id: Option<String>,
    /// Currently active window/tab title
    pub active_window_title: Option<String>,
    /// Currently active application name
    pub active_app_name: Option<String>,
    /// Current user session data from Supabase
    pub session_data: Option<SessionData>,
    /// Screen resolution multiplier for mouse distance normalization
    pub screen_resolution_multiplier: Option<f64>,
    /// Window/app change count
    pub window_change_count: u32,
    /// Browser tab change count (within same window)
    pub tab_change_count: u32,
    /// Last scroll event timestamp for debouncing
    pub last_scroll_event_time: Option<std::time::Instant>,
    /// Last mouse move event timestamp for gating (200ms window)
    pub last_mouse_move_time: Option<std::time::Instant>,
    /// Currently active app category
    pub current_app_category: Option<String>,
    /// History of category changes for majority calculation
    pub category_change_history: Vec<CategoryChangeEvent>,
    /// Current active session ID (UUID)
    pub current_session_id: Option<String>,
    /// Last time a minute log was successfully uploaded (for inactivity detection)
    pub last_activity_time: Option<Instant>,
    /// When the current session started
    pub session_start_time: Option<Instant>,
    /// Current extreme Z-score alert (if any)
    pub extreme_zscore_alert: Option<ExtremeZScoreAlert>,
    /// When the extreme Z-score alert was triggered (for 5-min timeout)
    pub extreme_zscore_alert_time: Option<Instant>,
    /// Count of consecutive inactive minutes (for notification trigger)
    pub consecutive_inactive_minutes: u32,
    /// Whether the 30-minute session notification was already sent
    pub sent_30min_notification: bool,
    /// Count of consecutive scoring intervals with score_total >= threshold
    pub consecutive_high_score_count: u32,
    /// Whether the break notification has been sent this session
    pub sent_break_notification: bool,
    /// Last time a break nudge was triggered (for cooldown)
    pub last_break_nudge_time: Option<Instant>,
    /// Last time a focus nudge was triggered (for cooldown)
    pub last_focus_nudge_time: Option<Instant>,
    /// Number of focus nudges sent in the current session (max 3)
    pub focus_nudge_count_session: u32,
    /// Whether a focus timer session is currently active
    pub focus_session_active: bool,
    /// When the focus timer session ends
    pub focus_session_end_time: Option<SystemTime>,
    /// Total duration of current focus session (for emit on complete)
    pub focus_session_total_secs: Option<u64>,
    /// Rolling window of per-minute tab change counts (last 5 minutes)
    pub recent_tab_changes: Vec<u32>,
    /// Rolling window of per-minute window change counts (last 5 minutes)
    pub recent_window_changes: Vec<u32>,
    /// Whether a break session is currently active (overlay open)
    pub break_session_active: bool,
    /// When the break session ends
    pub break_session_end_time: Option<SystemTime>,
    /// Whether a break nudge countdown is active (120s before auto-start)
    pub break_nudge_active: bool,
    /// When the break nudge countdown reaches 0
    pub break_nudge_end_time: Option<Instant>,
    /// Whether a focus nudge is active (stays until dismissed)
    pub focus_nudge_active: bool,
    /// Latest cognitive load from last 5-min interval (same as dashboard)
    pub last_cognitive_load: Option<f64>,
}

/// Represents a category change event for tracking time spent in each category
#[derive(Debug, Clone)]
pub struct CategoryChangeEvent {
    /// Category enum value
    pub category: String,
    /// Timestamp when category changed
    pub timestamp: Instant,
    /// App name that triggered this category
    #[allow(dead_code)]
    pub app_name: String,
}

/// Represents an extreme Z-score alert from cognitive score calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtremeZScoreAlert {
    /// The cognitive_scores table row ID
    pub cognitive_score_id: i64,
    /// Human-readable metric name (e.g., "Window Switching")
    pub metric_name: String,
    /// Direction description (e.g., "higher than usual")
    pub direction: String,
    /// The actual Z-score value
    pub z_score: f64,
}
