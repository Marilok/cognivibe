use tauri::AppHandle;
use tauri::Emitter;
use tauri_plugin_deep_link::DeepLinkExt;

use crate::modules::utils::focus_main_window_impl;
#[cfg(debug_assertions)]
use crate::modules::utils::get_deeplinks_prefix;

/// Sets up deep link handling for the Cognivibe application.
///
/// This function:
/// - Registers the "cognivibe://" protocol with the system
/// - Sets up event handlers for when deep links are opened
/// - Automatically focuses the main window when a deep link is activated
///
/// Note that there is also frontend handling for deep links in the web application,
/// but this backend setup ensures that the desktop application can respond to them.
///
/// Deep links allow external applications or websites to open and interact
/// with Cognivibe directly. When a cognivibe:// URL is opened, this handler
/// will bring the app to the foreground for the user.
///
/// # Arguments
/// * `app` - Reference to the Tauri app handle for accessing deep link functionality
///
/// # Returns
/// * `Ok(())` if setup was successful
/// * `Err(...)` if there was an error registering the protocol or setting up handlers
pub fn setup_deep_link_handlers(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    println!("{}Setting up deep link handlers", get_deeplinks_prefix());

    // Register deep link protocol
    app.deep_link().register("cognivibe")?;

    // Set up URL event handler
    let app_handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        // Get all URLs first to avoid ownership issues
        let all_urls = event.urls();

        // Filter for cognivibe protocol URLs
        let cognivibe_urls: Vec<String> = all_urls
            .iter()
            .filter(|url| url.as_str().starts_with("cognivibe://"))
            .map(|url| url.to_string())
            .collect();

        if let Some(_url) = cognivibe_urls.first() {
            #[cfg(debug_assertions)]
            println!(
                "{}Processing cognivibe deep link: {}",
                get_deeplinks_prefix(),
                _url
            );

            // Focus the main window
            focus_main_window_impl(&app_handle);

            // Forward to frontend handler (plugin JS listens for this event)
            // Payload is an array of URLs.
            let _ = app_handle.emit("deep-link://new-url", cognivibe_urls);
        } else {
            #[cfg(debug_assertions)]
            println!(
                "{}No cognivibe deep links found in: {:?}",
                get_deeplinks_prefix(),
                all_urls
            );
        }
    });

    // Register all deep links for development (doesn't work on macOS)
    #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
    {
        app.deep_link().register_all()?;
    }

    #[cfg(debug_assertions)]
    println!(
        "{}Deep link handlers setup completed successfully",
        get_deeplinks_prefix()
    );

    Ok(())
}
