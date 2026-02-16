pub mod clear_extreme_zscore_alert;
pub mod clear_session_state;
pub mod focus_timer;
pub mod tray_commands;
pub mod tray_menu;
pub mod get_extreme_zscore_alert;
pub mod get_measuring_state;
pub mod get_session_info;
pub mod get_settings_state;
pub mod get_user_session;
pub mod set_user_session;
// State-related functions are minimal since most functionality
// is handled by the respective domain modules (tracker, settings, etc.)
// This keeps the state module focused purely on state management
