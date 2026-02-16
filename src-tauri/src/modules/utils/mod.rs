pub mod functions;
pub mod types;

// Re-export commonly used items for convenience
#[cfg(debug_assertions)]
pub use functions::colors::{
    get_deeplinks_prefix, get_init_prefix, get_settings_prefix, get_tracker_prefix,
    get_utils_prefix,
};
pub use functions::capture_screen::capture_screen;
pub use functions::focus_main_window::focus_main_window_impl;
pub use functions::force_destroy_window::force_destroy_window;
pub use functions::get_api_base_url::get_api_base_url;
