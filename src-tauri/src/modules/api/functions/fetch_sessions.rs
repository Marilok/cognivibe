use crate::modules::api::types::{SessionData, SessionsApiResponse, SessionsResponse};
use crate::modules::state::functions::get_user_session::get_user_session;
use crate::modules::state::AppState;
use crate::modules::utils::get_api_base_url;
use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::env;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;
use tauri::{command, State};
use tauri_plugin_http::reqwest;

#[command]
pub async fn fetch_sessions_cmd(
    start_date: String,
    end_date: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<SessionsResponse, String> {
    let use_mock_data = env_truthy("COGNIVIBE_USE_MOCK_DATA") || env_truthy("VITE_USE_MOCK_DATA");

    // In mock mode, allow the dashboard to render even if the user isn't logged in yet.
    let session_data = match get_user_session(state.clone()) {
        Ok(session_opt) => session_opt,
        Err(e) if use_mock_data => {
            #[cfg(debug_assertions)]
            eprintln!("fetch_sessions_cmd: ignoring session error in mock mode: {e}");
            None
        }
        Err(e) => return Err(e),
    };

    let (_user_id, jwt_token) = if let Some(s) = session_data {
        (s.user_id, s.access_token)
    } else if use_mock_data {
        ("local-demo-user".to_string(), String::new())
    } else {
        return Err("No user session found. Please login first.".to_string());
    };

    if use_mock_data {
        let data = generate_mock_sessions(&start_date, &end_date)?;
        let response_body = SessionsResponse {
            success: true,
            message: "Mock sessions data (local)".to_string(),
            data,
        };
        return Ok(response_body);
    }

    // Get API base URL using the helper function
    let api_base_url = get_api_base_url()?;

    let url = format!(
        "{}/api/sessions?start_date={}&end_date={}",
        api_base_url.trim_end_matches('/'),
        start_date,
        end_date
    );

    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", jwt_token))
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!(
            "Request failed with status {}: {}",
            status, error_text
        ));
    }

    // Parse the response body as JSON
    let api_response: SessionsApiResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response as JSON: {}", e))?;

    // Build the final response
    let response_body = SessionsResponse {
        success: api_response.success,
        message: api_response.message,
        data: api_response.data,
    };

    Ok(response_body)
}

fn env_truthy(name: &str) -> bool {
    match env::var(name) {
        Ok(v) => matches!(
            v.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "y" | "on"
        ),
        Err(_) => false,
    }
}

fn hash_unit(seed: &str) -> f64 {
    let mut hasher = DefaultHasher::new();
    seed.hash(&mut hasher);
    let x = hasher.finish();
    (x as f64) / (u64::MAX as f64)
}

fn generate_mock_sessions(start_date: &str, end_date: &str) -> Result<Vec<SessionData>, String> {
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};

    let start = NaiveDate::parse_from_str(start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start_date format: {}", e))?;
    let end = NaiveDate::parse_from_str(end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end_date format: {}", e))?;

    let categories = vec![
        "Development",
        "Communication",
        "Meetings",
        "Docs and Writing",
        "Productivity and Planning",
        "Browsing and Research",
        "Design and Creative",
        "Data and Analytics",
        "Media and Entertainment",
        "Other",
    ];

    let mut sessions = Vec::new();
    let mut current_date = start;

    while current_date <= end {
        let day_seed = current_date.format("%Y-%m-%d").to_string();
        let day_hash = hash_unit(&format!("{}|cognivibe-mock-sessions", day_seed));

        // Generate 2-4 sessions per day
        let session_count = 2 + ((day_hash * 3.0) as usize);

        // Distribute sessions across 10:00-19:00 UTC
        let day_start_hour = 10;
        let day_end_hour = 19;
        let day_duration_hours = day_end_hour - day_start_hour;
        let time_slots = session_count + 1;

        for i in 0..session_count {
            let session_seed = format!("{}|session{}", day_seed, i);
            let r = hash_unit(&session_seed);

            // Position in the day
            let slot_position = (i + 1) as f64 / time_slots as f64;
            let base_hour = day_start_hour as f64 + slot_position * day_duration_hours as f64;

            // Add some randomness
            let random_offset = (hash_unit(&format!("{}|offset", session_seed)) - 0.5) * 0.5;
            let start_hour = ((base_hour + random_offset) as u32).max(day_start_hour).min(day_end_hour - 1);
            let start_minute = (((base_hour + random_offset).fract() * 60.0) as u32).min(59);

            let time_start = NaiveTime::from_hms_opt(start_hour, start_minute, 0)
                .ok_or_else(|| "Invalid time".to_string())?;
            let timestamp_start = NaiveDateTime::new(current_date, time_start);

            // Session duration: 45 to 150 minutes
            let duration_minutes = 45 + (hash_unit(&format!("{}|duration", session_seed)) * 105.0) as i64;
            let timestamp_end = timestamp_start + chrono::Duration::minutes(duration_minutes);

            // Skip if extends beyond end date
            if timestamp_end.date() > end {
                continue;
            }

            // Generate score (0-100)
            let time_of_day = start_hour;
            let base_score = if time_of_day < 12 {
                30.0 + r * 25.0
            } else if time_of_day < 15 {
                45.0 + r * 30.0
            } else {
                50.0 + r * 40.0
            };
            let score_total = (base_score + (hash_unit(&format!("{}|score", session_seed)) - 0.5) * 10.0)
                .max(0.0)
                .min(100.0);

            // Generate category share
            let top_category_count = 2 + (hash_unit(&format!("{}|cat_count", session_seed)) * 2.0) as usize;
            let mut selected_categories: Vec<&str> = Vec::new();
            let mut remaining_categories = categories.clone();

            for j in 0..top_category_count.min(remaining_categories.len()) {
                let idx = (hash_unit(&format!("{}|cat{}", session_seed, j)) * remaining_categories.len() as f64) as usize;
                let idx = idx.min(remaining_categories.len() - 1);
                selected_categories.push(remaining_categories.remove(idx));
            }

            let mut category_share: HashMap<String, f64> = HashMap::new();
            let mut remaining = 100.0;

            for (j, cat) in selected_categories.iter().enumerate() {
                let pct = if j == selected_categories.len() - 1 {
                    remaining
                } else {
                    let p = hash_unit(&format!("{}|pct{}", session_seed, j)) * remaining * 0.7 + remaining * 0.3;
                    remaining -= p;
                    p
                };
                category_share.insert(cat.to_string(), pct);
            }

            let start_str = timestamp_start.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
            let end_str = timestamp_end.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
            
            sessions.push(SessionData {
                id: format!("{:016x}", hash_unit(&session_seed).to_bits()),
                timestamp_start: start_str.clone(),
                timestamp_end: end_str.clone(),
                length: duration_minutes * 60, // in seconds
                score_total: Some(score_total),
                category_share,
                // In mock mode, activity timestamps match session timestamps
                activity_start: Some(start_str),
                activity_end: Some(end_str),
                pomodoro: false,
            });
        }

        current_date = current_date
            .succ_opt()
            .ok_or_else(|| "Failed to increment date".to_string())?;
    }

    // Sort by timestamp_start
    sessions.sort_by(|a, b| a.timestamp_start.cmp(&b.timestamp_start));

    Ok(sessions)
}
