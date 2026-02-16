use crate::modules::state::{AppState, ExtremeZScoreAlert};
use crate::modules::utils::get_api_base_url;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_http::reqwest;
use tauri_plugin_notification::NotificationExt;

/// Minimum session duration (seconds) before extreme Z-score alerts are shown
const MIN_SESSION_SECS_FOR_EXTREME_ALERT: u64 = 10 * 60; // 10 minutes

/// Request body for score calculation
#[derive(Debug, Serialize)]
struct ScoreRequest {
    timestamp: String,
    user_id: String,
}

/// Extreme Z-score info from server response
#[derive(Debug, Deserialize, Clone)]
struct ExtremeZScoreResponse {
    metric_key: String,
    metric_name: String,
    z_score: f64,
    direction: String,
}

/// Score calculation response from server
#[derive(Debug, Deserialize)]
struct ScoreResponse {
    success: bool,
    data: Option<ScoreData>,
    #[allow(dead_code)]
    message: Option<String>,
    #[allow(dead_code)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ScoreData {
    id: Option<i64>,
    score_total: Option<f64>,
    #[allow(dead_code)]
    score_frustration: Option<f64>,
    #[allow(dead_code)]
    score_pressure: Option<f64>,
    #[allow(dead_code)]
    score_concentration: Option<f64>,
    extreme_zscore: Option<ExtremeZScoreResponse>,
}

/// Check for extreme Z-score by requesting score calculation from server.
/// Also tracks consecutive high cognitive load scores and sends break notifications.
///
/// This should be called after uploading metrics on 5-minute boundaries.
///
/// `session_duration_secs` is used to suppress extreme Z-score alerts during the
/// first 10 minutes of a session (baselines are unreliable early on).
///
/// Returns true if an extreme Z-score alert was detected and stored.
pub async fn check_and_handle_extreme_zscore(
    app_handle: &AppHandle,
    timestamp: &str,
    user_id: &str,
    access_token: &str,
    session_duration_secs: u64,
) -> Result<bool, String> {
    // Get API base URL
    let api_base_url = get_api_base_url()?;
    let url = format!("{}/api/scores", api_base_url.trim_end_matches('/'));

    let request_body = ScoreRequest {
        timestamp: timestamp.to_string(),
        user_id: user_id.to_string(),
    };

    #[cfg(debug_assertions)]
    println!("[CHECK_ZSCORE] Requesting score for timestamp: {}", timestamp);

    // Send request to score endpoint
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send score request: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        #[cfg(debug_assertions)]
        eprintln!("[CHECK_ZSCORE] Score request failed: {} - {}", status, error_text);
        return Err(format!("Score request failed: {}", status));
    }

    // Parse response
    let score_response: ScoreResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse score response: {}", e))?;

    if !score_response.success {
        #[cfg(debug_assertions)]
        eprintln!("[CHECK_ZSCORE] Score calculation failed: {:?}", score_response.error);
        return Ok(false);
    }

    let data = match score_response.data {
        Some(d) => d,
        None => return Ok(false),
    };

    // --- Track consecutive high cognitive load scores (used by intervention system) ---
    if let Some(score_total) = data.score_total {
        let state = app_handle.state::<Mutex<AppState>>();
        if let Ok(mut app_state) = state.lock() {
            app_state.last_cognitive_load = Some(score_total);
            let threshold = app_state.settings.break_score_threshold as f64;
            if score_total >= threshold {
                app_state.consecutive_high_score_count += 1;
                #[cfg(debug_assertions)]
                println!(
                    "[CHECK_ZSCORE] High score ({:.1} >= {:.0}) - consecutive count: {}",
                    score_total, threshold, app_state.consecutive_high_score_count
                );
            } else {
                app_state.consecutive_high_score_count = 0;
            }
        };
    }

    // --- Extreme Z-score handling ---

    // Skip extreme Z-score alerts during the first 10 minutes of a session
    if session_duration_secs < MIN_SESSION_SECS_FOR_EXTREME_ALERT {
        #[cfg(debug_assertions)]
        println!(
            "[CHECK_ZSCORE] Skipping extreme Z-score check (session only {}s, need {}s)",
            session_duration_secs, MIN_SESSION_SECS_FOR_EXTREME_ALERT
        );
        return Ok(false);
    }

    let extreme_zscore = match data.extreme_zscore {
        Some(ez) => ez,
        None => {
            #[cfg(debug_assertions)]
            println!("[CHECK_ZSCORE] No extreme Z-score detected");
            return Ok(false);
        }
    };

    // Skip scrolling-related metrics entirely (wheel_slope, wheel_sd, wheel_mean)
    if extreme_zscore.metric_key.starts_with("wheel") {
        #[cfg(debug_assertions)]
        println!(
            "[CHECK_ZSCORE] Ignoring scrolling extreme Z-score: {} (z={})",
            extreme_zscore.metric_key, extreme_zscore.z_score
        );
        return Ok(false);
    }

    let cognitive_score_id = match data.id {
        Some(id) => id,
        None => {
            #[cfg(debug_assertions)]
            eprintln!("[CHECK_ZSCORE] Extreme Z-score detected but no cognitive_score_id");
            return Ok(false);
        }
    };

    #[cfg(debug_assertions)]
    println!(
        "[CHECK_ZSCORE] Extreme Z-score detected! metric={}, direction={}, z={}",
        extreme_zscore.metric_name, extreme_zscore.direction, extreme_zscore.z_score
    );

    // Create alert
    let alert = ExtremeZScoreAlert {
        cognitive_score_id,
        metric_name: extreme_zscore.metric_name.clone(),
        direction: extreme_zscore.direction.clone(),
        z_score: extreme_zscore.z_score,
    };

    // Store alert in AppState
    {
        let state = app_handle.state::<Mutex<AppState>>();
        if let Ok(mut app_state) = state.lock() {
            app_state.extreme_zscore_alert = Some(alert.clone());
            app_state.extreme_zscore_alert_time = Some(Instant::now());
            #[cfg(debug_assertions)]
            println!("[CHECK_ZSCORE] Alert stored in AppState");
        };
    }

    // Emit event to frontend
    if let Err(e) = app_handle.emit("extreme-zscore-alert", &alert) {
        #[cfg(debug_assertions)]
        eprintln!("[CHECK_ZSCORE] Failed to emit event: {}", e);
    } else {
        #[cfg(debug_assertions)]
        println!("[CHECK_ZSCORE] Event emitted to frontend");
    }

    // 10% chance to send push notification (reduced from 30%)
    if rand_chance(0.10) {
        let notification_body = format!(
            "Your {} is {}. Help us improve accuracy.",
            extreme_zscore.metric_name, extreme_zscore.direction
        );
        
        if let Err(e) = app_handle
            .notification()
            .builder()
            .title("Cognivibe")
            .body(&notification_body)
            .show()
        {
            #[cfg(debug_assertions)]
            eprintln!("[CHECK_ZSCORE] Failed to send notification: {}", e);
        } else {
            #[cfg(debug_assertions)]
            println!("[CHECK_ZSCORE] Push notification sent");
        }
    }

    Ok(true)
}

/// Generate a random boolean with the given probability
fn rand_chance(probability: f64) -> bool {
    use std::time::SystemTime;
    
    // Simple pseudo-random based on system time nanoseconds
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    
    let rand_value = (nanos as f64) / (u32::MAX as f64);
    rand_value < probability
}
