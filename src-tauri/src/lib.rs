use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;
use tauri::menu::MenuEvent;
use tauri::tray::TrayIconBuilder;

use dotenv::dotenv;
#[cfg(debug_assertions)]
use dotenv::from_filename;

mod modules;

use modules::api::functions::{backfill_scores_cmd, fetch_batch_scores_cmd, fetch_productivity_time_cmd, fetch_sessions_cmd};
use modules::deeplinks::setup_deep_link_handlers;
use modules::settings::{load_settings_from_store, update_settings_cmd};
use modules::state::{
    clear_extreme_zscore_alert, clear_session_state, get_extreme_zscore_alert,
    get_measuring_state, get_session_info, get_settings_state, set_user_session, AppState,
    start_focus_session, get_focus_session_state, stop_focus_session, extend_focus_session,
};
use modules::tracker::{start_global_input_tracker, toggle_measuring};
use modules::tracker::functions::session_management::end_session;

#[cfg(not(debug_assertions))]
use modules::utils::{capture_screen, focus_main_window_impl, force_destroy_window};
#[cfg(debug_assertions)]
use modules::utils::{capture_screen, focus_main_window_impl, force_destroy_window, get_init_prefix};

pub fn run() -> () {
    let builder = tauri::Builder::default();

    dotenv().ok();
    // Load Vite's development env file when running `tauri dev`.
    // We try both root-relative and src-tauri-relative paths so it works regardless of CWD.
    #[cfg(debug_assertions)]
    {
        let _ = from_filename(".env.development.local");
        let _ = from_filename("../.env.development.local");
    }

    #[cfg(desktop)]
    builder
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            toggle_measuring,
            get_measuring_state,
            get_session_info,
            get_settings_state,
            set_user_session,
            clear_session_state,
            update_settings_cmd,
            backfill_scores_cmd,
            fetch_batch_scores_cmd,
            fetch_productivity_time_cmd,
            fetch_sessions_cmd,
            get_extreme_zscore_alert,
            clear_extreme_zscore_alert,
            start_focus_session,
            get_focus_session_state,
            stop_focus_session,
            extend_focus_session,
            modules::state::functions::tray_commands::start_break_session,
            modules::state::functions::tray_commands::end_break_session,
            modules::state::functions::tray_commands::extend_break_session,
            modules::state::functions::tray_commands::extend_break_nudge,
            modules::state::functions::tray_commands::dismiss_break_nudge,
            modules::state::functions::tray_commands::dismiss_focus_nudge,
            capture_screen,
            force_destroy_window,
            modules::utils::functions::focus_main_window::focus_main_window,
            modules::utils::functions::open_notification_settings::open_notification_settings
        ])
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Focus main window
            focus_main_window_impl(&app);

            // On macOS (and sometimes other platforms), deep links can arrive as
            // command-line arguments to the already-running app instance.
            // Forward those URLs to the frontend using the event that
            // `@tauri-apps/plugin-deep-link` listens for.
            let urls: Vec<String> = args
                .into_iter()
                .filter(|arg| arg.starts_with("cognivibe://"))
                .collect();

            if !urls.is_empty() {
                #[cfg(debug_assertions)]
                println!("{}Deep link received via single-instance args: {:?}", get_init_prefix(), urls);

                let _ = app.emit("deep-link://new-url", urls);
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_macos_permissions::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_prevent_default::debug())
        .setup(|app| {
            #[cfg(debug_assertions)]
            println!("{}Starting Cognivibe application setup", get_init_prefix());

            // Autostart
            let _ = app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec!["--flag1"]), /* arbitrary number of args to pass to your app */
            ));

            // Deep link setup
            if let Err(_e) = setup_deep_link_handlers(app.handle()) {
                #[cfg(debug_assertions)]
                eprintln!("{}⚠️ Deep link setup failed: {}", get_init_prefix(), _e);
            }

            // Load settings from store and initialize app state
            let app_state = app.state::<Mutex<AppState>>();

            // Load settings from store or use defaults
            let settings = load_settings_from_store(app.handle());

            // Update app state with loaded settings
            {
                match app_state.lock() {
                    Ok(mut state) => {
                        state.settings = settings.clone();

                        // Auto-start measuring if configured
                        if settings.should_autostart_measuring {
                            #[cfg(debug_assertions)]
                            println!(
                                "{}Auto-starting measurement as configured",
                                get_init_prefix()
                            );
                            state.is_measuring = true;
                            state.is_first_minute = true;
                        }
                    }
                    Err(e) => {
                        #[cfg(debug_assertions)]
                        eprintln!("{}⚠️ Failed to lock app state during setup: {}", get_init_prefix(), e);
                        // Continue anyway - state will have defaults
                    }
                }
            }

            // Check for updates (debug only)
            #[cfg(debug_assertions)]
            {
                use tauri_plugin_updater::UpdaterExt;
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    match handle.updater() {
                        Ok(updater) => match updater.check().await {
                            Ok(Some(update)) => {
                                println!(
                                    "{}Update available: version {} -> {}",
                                    get_init_prefix(),
                                    update.current_version,
                                    update.version
                                );
                            }
                            Ok(None) => {
                                println!("{}Application is up to date", get_init_prefix());
                            }
                            Err(e) => {
                                println!("{}Failed to check for updates: {}", get_init_prefix(), e);
                            }
                        },
                        Err(e) => {
                            println!("{}Failed to initialize updater: {}", get_init_prefix(), e);
                        }
                    }
                });
            }

            // Start global input tracker (this will handle all input events)
            #[cfg(debug_assertions)]
            println!("{}Starting global input tracker", get_init_prefix());
            start_global_input_tracker(app.handle().clone());

            // System tray with dynamic menu
            let menu = modules::state::functions::tray_menu::build_tray_menu(app.handle())
                .unwrap_or_else(|_| {
                    tauri::menu::MenuBuilder::new(app.handle())
                        .text("show", "Show CogniVibe")
                        .separator()
                        .text("quit", "Quit")
                        .build()
                        .expect("fallback menu build")
                });

            let _tray = {
                let builder = TrayIconBuilder::with_id("main")
                    .icon(tauri::include_image!("icons/tray-icon.png"))
                    .menu(&menu);
                #[cfg(target_os = "macos")]
                let builder = builder.icon_as_template(true);
                builder.on_menu_event(move |app, event: MenuEvent| {
                    match event.id.as_ref() {
                        "show" => {
                            focus_main_window_impl(app);
                        }
                        "add_5_min" => {
                            let _ = modules::state::functions::focus_timer::extend_focus_session(
                                app.clone(),
                                5 * 60,
                            );
                            modules::state::functions::focus_timer::schedule_tray_menu(app);
                        }
                        "skip_to_break" => {
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = modules::state::functions::focus_timer::stop_focus_session(app_clone.clone());
                                let _ = app_clone.emit("focus-session-skip", ());
                                modules::state::functions::focus_timer::schedule_tray_menu(&app_clone);
                            });
                        }
                        "cancel_focus" => {
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = modules::state::functions::focus_timer::stop_focus_session(app_clone.clone());
                                let _ = app_clone.emit("focus-session-cancelled", ());
                                modules::state::functions::focus_timer::schedule_tray_menu(&app_clone);
                            });
                        }
                        "add_1_min_break" => {
                            let _ = modules::state::functions::tray_commands::extend_break_session(
                                app.clone(),
                                60,
                            );
                            modules::state::functions::focus_timer::schedule_tray_menu(app);
                        }
                        "skip_break" => {
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = modules::state::functions::tray_commands::end_break_session(app_clone.clone());
                                let _ = app_clone.emit("tray-skip-break", ());
                                modules::state::functions::focus_timer::schedule_tray_menu(&app_clone);
                            });
                        }
                        "prolong_nudge" => {
                            let _ = modules::state::functions::tray_commands::extend_break_nudge(
                                app.clone(),
                                120,
                            );
                            modules::state::functions::focus_timer::schedule_tray_menu(app);
                        }
                        "start_nudge" => {
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = modules::state::functions::tray_commands::dismiss_break_nudge(app_clone.clone());
                                focus_main_window_impl(&app_clone);
                                let _ = app_clone.emit("break-warning-action", serde_json::json!({ "action": "start" }));
                                modules::state::functions::focus_timer::schedule_tray_menu(&app_clone);
                            });
                        }
                        "dismiss_nudge" => {
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = modules::state::functions::tray_commands::dismiss_break_nudge(app_clone.clone());
                                let _ = app_clone.emit("break-warning-action", serde_json::json!({ "action": "skip" }));
                                modules::state::functions::focus_timer::schedule_tray_menu(&app_clone);
                            });
                        }
                        "start_focus" => {
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = modules::state::functions::tray_commands::dismiss_focus_nudge(app_clone.clone());
                                focus_main_window_impl(&app_clone);
                                let _ = app_clone.emit("focus-action", serde_json::json!({ "action": "start" }));
                                modules::state::functions::focus_timer::schedule_tray_menu(&app_clone);
                            });
                        }
                        "dismiss_focus" => {
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = modules::state::functions::tray_commands::dismiss_focus_nudge(app_clone.clone());
                                let _ = app_clone.emit("focus-action", serde_json::json!({ "action": "dismiss" }));
                                modules::state::functions::focus_timer::schedule_tray_menu(&app_clone);
                            });
                        }
                        "quit" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let session_info = {
                                    let state = app_handle.state::<Mutex<AppState>>();
                                    let app_state = match state.lock() {
                                        Ok(state) => state,
                                        Err(_) => return,
                                    };
                                    if let (Some(session_id), Some(session)) = (
                                        app_state.current_session_id.clone(),
                                        app_state.session_data.clone(),
                                    ) {
                                        Some((session_id, session.access_token))
                                    } else {
                                        None
                                    }
                                };
                                if let Some((session_id, access_token)) = session_info {
                                    #[cfg(debug_assertions)]
                                    println!(
                                        "{}🛑 Ending session {} on quit",
                                        get_init_prefix(),
                                        session_id
                                    );
                                    let _ = end_session(session_id, access_token).await;
                                }
                                let handle_for_exit = app_handle.clone();
                                let _ = app_handle.run_on_main_thread(move || {
                                    handle_for_exit.exit(0);
                                });
                            });
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            };

            // Start unified tray update loop (focus, break, nudges, cognitive load)
            modules::state::functions::focus_timer::spawn_tray_update_loop(app.handle().clone());

            // Window close: hide to tray instead of quitting
            let app_handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(w) = app_handle.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                });
            } else {
                #[cfg(debug_assertions)]
                eprintln!("{}⚠️ Main window not found, cannot set up close handler", get_init_prefix());
            }

            #[cfg(debug_assertions)]
            println!(
                "{}Cognivibe application setup completed successfully",
                get_init_prefix()
            );

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
