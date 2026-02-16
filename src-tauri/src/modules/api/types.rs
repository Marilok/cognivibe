use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct DateRange {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchScoresResponse {
    pub success: bool,
    pub message: String,
    pub user_id: String,
    pub date_range: DateRange,
    pub data: serde_json::Value, // Using Value since we don't know the exact structure of scores data
    pub missing_data: Vec<MissingDataPoint>,
}

// API response without missing_data field (for initial parsing)
#[derive(Debug, Serialize, Deserialize)]
pub struct BatchScoresApiResponse {
    pub success: bool,
    pub message: String,
    pub user_id: String,
    pub date_range: DateRange,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MissingDataPoint {
    pub timestamp: String,
    pub score_total: Option<f64>,
    pub score_focus: Option<f64>,
    pub score_strain: Option<f64>,
    pub score_energy: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchScoresRequest {
    pub start_date: String,
    pub end_date: String,
    pub user_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductivityTimeRequest {
    pub user_id: String,
    pub date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductivityTimeResponse {
    pub success: bool,
    pub message: String,
    pub user_id: String,
    pub date: String,
    pub data: std::collections::HashMap<String, u64>,
}

// Sessions API types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionData {
    pub id: String,
    pub timestamp_start: String,
    pub timestamp_end: String,
    pub length: i64,
    pub score_total: Option<f64>,
    pub category_share: std::collections::HashMap<String, f64>,
    // Actual activity timestamps from behavioral_metrics_log (MIN/MAX of minute_timestamp)
    // These represent when user activity actually occurred, not session creation/end times
    #[serde(default)]
    pub activity_start: Option<String>,
    #[serde(default)]
    pub activity_end: Option<String>,
    #[serde(default)]
    pub pomodoro: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionsResponse {
    pub success: bool,
    pub message: String,
    pub data: Vec<SessionData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionsApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Vec<SessionData>,
}
