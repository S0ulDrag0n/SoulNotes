use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream, StreamConfig};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use reqwest;
use futures_util::StreamExt;

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
struct AudioChunk {
    data: Vec<u8>,
    sample_rate: u32,
    channels: u16,
    source: String, // "mic" or "system"
}

// Config structure for YAML file
#[derive(Clone, serde::Serialize, serde::Deserialize, Debug, Default)]
pub struct AppConfig {
    pub speaches_base_url: Option<String>,
    pub speaches_transcribe_model: Option<String>,
    pub speaches_transcribe_language: Option<String>,
    pub ollama_base_url: Option<String>,
    pub ollama_api_token: Option<String>,
    pub ollama_translate_model: Option<String>,
    pub ollama_summarize_model: Option<String>,
    pub translate_prompt: Option<String>,
    pub summarize_prompt: Option<String>,
    // Audio device settings - persisted for user convenience
    pub mic_device: Option<String>,
    pub system_audio_device: Option<String>,
    pub capture_mode: Option<String>, // "mic", "system", or "dual"
}

// State for dual audio capture
struct AudioState {
    mic_stream: Mutex<Option<Stream>>,
    system_stream: Mutex<Option<Stream>>,
    is_recording: AtomicBool,
    capture_mode: Mutex<String>, // "mic", "system", "dual"
    config: Mutex<AppConfig>,
}

// Safe wrapper for Stream since cpal Stream is not Send/Sync
unsafe impl Send for AudioState {}
unsafe impl Sync for AudioState {}

// Helper to get config file path - use local directory (next to executable)
fn get_config_path(_app_handle: &AppHandle) -> PathBuf {
    // Try to get the executable's directory
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join("config.yml");
        }
    }
    // Fallback to current working directory
    PathBuf::from("config.yml")
}

// Load config from YAML file
fn load_config(app_handle: &AppHandle) -> AppConfig {
    let config_path = get_config_path(app_handle);
    log::info!("Loading config from: {:?}", config_path);
    
    if config_path.exists() {
        match fs::read_to_string(&config_path) {
            Ok(content) => {
                match serde_yaml::from_str::<AppConfig>(&content) {
                    Ok(config) => {
                        log::info!("Loaded config: {:?}", config);
                        return config;
                    }
                    Err(e) => {
                        log::error!("Failed to parse config YAML: {}", e);
                    }
                }
            }
            Err(e) => {
                log::error!("Failed to read config file: {}", e);
            }
        }
    } else {
        log::info!("Config file not found, using defaults");
    }
    
    AppConfig::default()
}

#[tauri::command]
fn get_audio_devices() -> Result<Vec<(String, String)>, String> {
    let host = cpal::default_host();
    let devices: Vec<(String, String)> = host
        .input_devices()
        .map_err(|e| e.to_string())?
        .filter_map(|d| d.name().ok())
        .map(|name| (name.clone(), name))
        .collect();
    Ok(devices)
}

#[tauri::command]
fn get_system_audio_devices() -> Result<Vec<(String, String)>, String> {
    // On Windows, system audio requires WASAPI loopback
    // This returns available output devices that can be captured as loopback
    let host = cpal::default_host();
    let devices: Vec<(String, String)> = host
        .output_devices()
        .map_err(|e| e.to_string())?
        .filter_map(|d| d.name().ok())
        .map(|name| (name.clone(), name))
        .collect();
    Ok(devices)
}

// Helper to build audio stream for a device
fn build_audio_stream(
    device: &cpal::Device,
    is_input: bool,
    is_recording: Arc<AtomicBool>,
    app_handle: AppHandle,
    source_name: String,
) -> Result<Stream, String> {
    let app_err = app_handle.clone();
    let app_data = app_handle.clone();
    let source_name_err = source_name.clone();
    
    let err_fn = move |err: cpal::StreamError| {
        log::error!("Audio stream error for {}: {}", source_name_err, err);
        let _ = app_err.emit("audio-error", format!("{}: {}", source_name_err, err));
    };

    let config: cpal::SupportedStreamConfig = if is_input {
        device.default_input_config()
            .map_err(|e| e.to_string())?
    } else {
        device.default_output_config()
            .map_err(|e| e.to_string())?
    };

    let stream_config: StreamConfig = config.clone().into();
    let sample_rate = config.sample_rate().0;
    let channels = config.channels();
    let source = source_name.clone();

    let stream = match config.sample_format() {
        SampleFormat::F32 => {
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _: &_| {
                    if !is_recording.load(Ordering::SeqCst) { return; }
                    let bytes: Vec<u8> = data.iter()
                        .flat_map(|&s| s.to_le_bytes())
                        .collect();
                    let _ = app_data.emit("audio-chunk", AudioChunk {
                        data: bytes,
                        sample_rate,
                        channels,
                        source: source.clone(),
                    });
                },
                err_fn,
                None,
            )
        }
        SampleFormat::I16 => {
            device.build_input_stream(
                &stream_config,
                move |data: &[i16], _: &_| {
                    if !is_recording.load(Ordering::SeqCst) { return; }
                    let bytes: Vec<u8> = data.iter()
                        .flat_map(|&s| s.to_le_bytes())
                        .collect();
                    let _ = app_data.emit("audio-chunk", AudioChunk {
                        data: bytes,
                        sample_rate,
                        channels,
                        source: source.clone(),
                    });
                },
                err_fn,
                None,
            )
        }
        _ => return Err("Unsupported sample format".to_string()),
    }.map_err(|e| e.to_string())?;

    Ok(stream)
}

#[tauri::command]
async fn start_audio_capture(
    app: AppHandle,
    device_name: Option<String>,
    is_system_audio: bool,
) -> Result<(), String> {
    let state = app.state::<AudioState>();
    
    if state.is_recording.load(Ordering::SeqCst) {
        return Err("Already recording".to_string());
    }

    let host = cpal::default_host();
    let is_recording = Arc::new(AtomicBool::new(true));
    
    // Select device: microphone input or system audio (loopback)
    let device = if is_system_audio {
        host.default_output_device()
            .ok_or("No default output device for system audio capture")?
    } else {
        match &device_name {
            Some(name) => host.input_devices()
                .map_err(|e| e.to_string())?
                .find(|d| d.name().as_ref().map(|n| n == name).unwrap_or(false))
                .ok_or("Device not found")?,
            None => host.default_input_device()
                .ok_or("No default input device")?,
        }
    };

    let stream = build_audio_stream(&device, true, is_recording.clone(), app.clone(), 
        if is_system_audio { "system".to_string() } else { "mic".to_string() })?;
    stream.play().map_err(|e| e.to_string())?;
    
    *state.mic_stream.lock().unwrap() = Some(stream);
    state.is_recording.store(true, Ordering::SeqCst);
    *state.capture_mode.lock().unwrap() = if is_system_audio { "system".to_string() } else { "mic".to_string() };
    
    Ok(())
}

#[tauri::command]
async fn start_dual_audio_capture(
    app: AppHandle,
    mic_device: Option<String>,
    system_device: Option<String>,
) -> Result<(), String> {
    let state = app.state::<AudioState>();
    
    if state.is_recording.load(Ordering::SeqCst) {
        return Err("Already recording".to_string());
    }

    let host = cpal::default_host();
    let is_recording = Arc::new(AtomicBool::new(true));
    
    // Get microphone device
    let mic = match &mic_device {
        Some(name) => host.input_devices()
            .map_err(|e| e.to_string())?
            .find(|d| d.name().as_ref().map(|n| n == name).unwrap_or(false))
            .ok_or("Microphone device not found")?,
        None => host.default_input_device()
            .ok_or("No default input device")?,
    };
    
    // Get system audio device (output device for loopback)
    let system = match &system_device {
        Some(name) => host.output_devices()
            .map_err(|e| e.to_string())?
            .find(|d| d.name().as_ref().map(|n| n == name).unwrap_or(false))
            .ok_or("System audio device not found")?,
        None => host.default_output_device()
            .ok_or("No default output device")?,
    };

    // Build mic stream
    let mic_stream = build_audio_stream(&mic, true, is_recording.clone(), app.clone(), "mic".to_string())?;
    mic_stream.play().map_err(|e| e.to_string())?;
    
    // Build system audio stream
    let system_stream = build_audio_stream(&system, false, is_recording.clone(), app.clone(), "system".to_string())?;
    system_stream.play().map_err(|e| e.to_string())?;
    
    *state.mic_stream.lock().unwrap() = Some(mic_stream);
    *state.system_stream.lock().unwrap() = Some(system_stream);
    state.is_recording.store(true, Ordering::SeqCst);
    *state.capture_mode.lock().unwrap() = "dual".to_string();
    
    Ok(())
}

#[tauri::command]
async fn stop_audio_capture(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    state.is_recording.store(false, Ordering::SeqCst);
    *state.mic_stream.lock().unwrap() = None;
    *state.system_stream.lock().unwrap() = None;
    *state.capture_mode.lock().unwrap() = String::new();
    Ok(())
}

#[tauri::command]
fn is_recording(app: AppHandle) -> bool {
    let state = app.state::<AudioState>();
    state.is_recording.load(Ordering::SeqCst)
}

#[tauri::command]
fn get_capture_mode(app: AppHandle) -> String {
    let state = app.state::<AudioState>();
    let mode = state.capture_mode.lock().unwrap().clone();
    mode
}

// Get config from YAML file
#[tauri::command]
fn get_config(app: AppHandle) -> AppConfig {
    let state = app.state::<AudioState>();
    let config = state.config.lock().unwrap().clone();
    config
}

// Save config to YAML file (merges with existing values)
#[tauri::command]
fn save_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let config_path = get_config_path(&app);
    
    // Ensure directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    // Get current in-memory config
    let state = app.state::<AudioState>();
    let current_config = state.config.lock().unwrap().clone();
    
    // Merge: new values override old ones, but keep old ones if new ones are None/empty
    let merged = AppConfig {
        speaches_base_url: config.speaches_base_url.filter(|s| !s.is_empty())
            .or(current_config.speaches_base_url),
        speaches_transcribe_model: config.speaches_transcribe_model.filter(|s| !s.is_empty())
            .or(current_config.speaches_transcribe_model),
        speaches_transcribe_language: config.speaches_transcribe_language.filter(|s| !s.is_empty())
            .or(current_config.speaches_transcribe_language),
        ollama_base_url: config.ollama_base_url.filter(|s| !s.is_empty())
            .or(current_config.ollama_base_url),
        ollama_api_token: config.ollama_api_token.filter(|s| !s.is_empty())
            .or(current_config.ollama_api_token),
        ollama_translate_model: config.ollama_translate_model.filter(|s| !s.is_empty())
            .or(current_config.ollama_translate_model),
        ollama_summarize_model: config.ollama_summarize_model.filter(|s| !s.is_empty())
            .or(current_config.ollama_summarize_model),
        translate_prompt: config.translate_prompt.filter(|s| !s.is_empty())
            .or(current_config.translate_prompt),
        summarize_prompt: config.summarize_prompt.filter(|s| !s.is_empty())
            .or(current_config.summarize_prompt),
        mic_device: config.mic_device.filter(|s| !s.is_empty())
            .or(current_config.mic_device),
        system_audio_device: config.system_audio_device.filter(|s| !s.is_empty())
            .or(current_config.system_audio_device),
        capture_mode: config.capture_mode.filter(|s| !s.is_empty())
            .or(current_config.capture_mode),
    };
    
    // Serialize and write merged config
    let yaml = serde_yaml::to_string(&merged).map_err(|e| e.to_string())?;
    fs::write(&config_path, yaml).map_err(|e| e.to_string())?;
    
    // Update in-memory config with merged values
    *state.config.lock().unwrap() = merged;
    
    log::info!("Config saved to: {:?}", config_path);
    Ok(())
}

// Get default config values
#[tauri::command]
fn get_default_config() -> AppConfig {
    AppConfig {
        speaches_base_url: Some("http://10.61.46.95:10300".to_string()),
        speaches_transcribe_model: Some("Systran/faster-whisper-large-v3".to_string()),
        speaches_transcribe_language: Some("zh".to_string()),
        ollama_base_url: Some("http://10.61.46.95:10102".to_string()),
        ollama_api_token: None,
        ollama_translate_model: Some("aya-expanse:latest".to_string()),
        ollama_summarize_model: Some("phi4:latest".to_string()),
        translate_prompt: None,
        summarize_prompt: None,
        mic_device: None,
        system_audio_device: None,
        capture_mode: None,
    }
}

// Save device settings to config
#[tauri::command]
fn save_device_settings(
    app: AppHandle,
    mic_device: Option<String>,
    system_audio_device: Option<String>,
    capture_mode: Option<String>,
) -> Result<(), String> {
    let state = app.state::<AudioState>();
    let mut config = state.config.lock().unwrap().clone();
    
    config.mic_device = mic_device;
    config.system_audio_device = system_audio_device;
    config.capture_mode = capture_mode;
    
    // Use the save_config logic
    let config_path = get_config_path(&app);
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let yaml = serde_yaml::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(&config_path, yaml).map_err(|e| e.to_string())?;
    
    // Update in-memory config
    *state.config.lock().unwrap() = config;
    
    log::info!("Device settings saved");
    Ok(())
}

// Save language preference to config
#[tauri::command]
fn save_language(app: AppHandle, language: String) -> Result<(), String> {
    let state = app.state::<AudioState>();
    let mut config = state.config.lock().unwrap().clone();
    
    config.speaches_transcribe_language = Some(language.clone());
    
    // Log before moving config
    log::info!("Language preference saved: {}", language);
    
    // Use the save_config logic
    let config_path = get_config_path(&app);
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let yaml = serde_yaml::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(&config_path, yaml).map_err(|e| e.to_string())?;
    
    // Update in-memory config
    *state.config.lock().unwrap() = config;
    
    Ok(())
}

// Translate text using Ollama - streaming version for Tauri
#[tauri::command]
async fn translate_text(
    app: AppHandle,
    text: String,
    source_language: String,
    target_language: String,
) -> Result<String, String> {
    let state = app.state::<AudioState>();
    let config = state.config.lock().unwrap().clone();
    
    // Use env var, config file, or default for Ollama settings
    let base_url = std::env::var("OLLAMA_BASE_URL")
        .ok()
        .or(config.ollama_base_url)
        .unwrap_or_else(|| "http://10.61.46.95:10102".to_string());
    
    let model = std::env::var("OLLAMA_TRANSLATE_MODEL")
        .ok()
        .or(config.ollama_translate_model)
        .unwrap_or_else(|| "aya-expanse:latest".to_string());
    
    let client = reqwest::Client::new();
    let url = format!("{}/api/chat", base_url);
    
    // Language labels mapping
    let language_labels = [
        ("en", "English"),
        ("es", "Spanish"),
        ("fr", "French"),
        ("de", "German"),
        ("it", "Italian"),
        ("pt", "Portuguese"),
        ("ja", "Japanese"),
        ("ko", "Korean"),
        ("ar", "Arabic"),
        ("zh", "Chinese"),
        ("zh-simplified", "Simplified Chinese"),
        ("zh-traditional", "Traditional Chinese"),
    ];
    
    let source_label = language_labels.iter()
        .find(|&&(code, _)| code == source_language)
        .map(|&(_, label)| label)
        .unwrap_or(&source_language);
        
    let target_label = language_labels.iter()
        .find(|&&(code, _)| code == target_language)
        .map(|&(_, label)| label)
        .unwrap_or(&target_language);
    
    // Default prompt template for translation
    let default_translate_prompt = "Translate the following text from {source_language} to {target_language}. Translate as literally as possible. Preserve wording, order, repetition, fragments, and informal phrasing. Do not paraphrase or smooth the text. Do not add explanations or inferred meaning. Only return the translated text. Use clear paragraph breaks with a blank line between paragraphs.\n\n{text}";
    
    // Use configured prompt or default
    let prompt_template = config.translate_prompt.as_deref().unwrap_or(default_translate_prompt);
    let prompt = prompt_template
        .replace("{source_language}", source_label)
        .replace("{target_language}", target_label)
        .replace("{text}", &text);
    
    let mut request_builder = client
        .post(&url)
        .header("Content-Type", "application/json");
        
    // Add authorization header if token is provided (env var or config)
    if let Some(token) = std::env::var("OLLAMA_API_TOKEN").ok().or(config.ollama_api_token.clone()) {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", token));
    }
    
    // Use chat/completions format with messages array - ENABLE STREAMING
    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": true,
        "temperature": 0.3,
        "num_predict": 2048,
        "top_p": 0.9,
        "top_k": 50,
    });
    
    let response = request_builder
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Translation request failed: {}", e))?;
    
    // Check status
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Translation API error: {} - {}", status, error_text));
    }
    
    // Stream the response
    let mut full_text = String::new();
    let mut stream = response.bytes_stream();
    
    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                let chunk_str = String::from_utf8_lossy(&chunk);
                // Ollama sends JSON objects separated by newlines
                for line in chunk_str.lines() {
                    if line.trim().is_empty() {
                        continue;
                    }
                    // Parse each JSON line
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                        if let Some(content) = json.get("message")
                            .and_then(|msg| msg.get("content"))
                            .and_then(|c| c.as_str()) 
                        {
                            full_text.push_str(content);
                            // Emit streaming event to frontend
                            let _ = app.emit("translation-chunk", content);
                        }
                        // Check if done
                        if json.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
                            break;
                        }
                    }
                }
            }
            Err(e) => {
                log::error!("Stream error: {}", e);
                break;
            }
        }
    }
    
    // Emit completion event
    let _ = app.emit("translation-complete", &full_text);
        
    Ok(full_text)
}

// Summarize text using Ollama - direct connection
#[tauri::command]
async fn summarize_text(app: AppHandle, text: String) -> Result<String, String> {
    let state = app.state::<AudioState>();
    let config = state.config.lock().unwrap().clone();
    
    // Use env var, config file, or default for Ollama settings
    let base_url = std::env::var("OLLAMA_BASE_URL")
        .ok()
        .or(config.ollama_base_url)
        .unwrap_or_else(|| "http://10.61.46.95:10102".to_string());
    
    let model = std::env::var("OLLAMA_SUMMARIZE_MODEL")
        .ok()
        .or(config.ollama_summarize_model)
        .unwrap_or_else(|| "phi4:latest".to_string());
    
    let client = reqwest::Client::new();
    let url = format!("{}/api/chat", base_url);
    
    // Default prompt template for summarization
    let default_summarize_prompt = "SUMMARIZE THE FOLLOWING CONTENT IN EXACTLY THE SAME FORMAT AND STRUCTURE SHOWN BELOW. DO NOT ADD ANY TEXT BEFORE OR AFTER THE SUMMARY.

FORMAT (MUST FOLLOW EXACTLY):
# [Meeting Title]

## ACTION ITEMS
- [Action item]

## MEETING SUMMARY
### Meeting Purpose
[Purpose]

### Key Takeaways
- [Takeaway]

### Topics
- [Topic]

### Next Steps
- [Next step]

RULES:
- Use concise, factual language - no fluff or explanations
- Each bullet should be 1-2 sentences with concrete details
- Do not include placeholder text like [Meeting Title] - use actual content
- If a field is unknown, omit that section entirely
- Preserve exact section spacing with blank lines between sections
- Output ONLY the summary in the exact format - no other text

CONTENT:
{text}";
    
    // Use configured prompt or default
    let prompt_template = config.summarize_prompt.as_deref().unwrap_or(default_summarize_prompt);
    let prompt = prompt_template.replace("{text}", &text);
    
    let mut request_builder = client
        .post(&url)
        .header("Content-Type", "application/json");
        
    // Add authorization header if token is provided (env var or config)
    if let Some(token) = std::env::var("OLLAMA_API_TOKEN").ok().or(config.ollama_api_token) {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", token));
    }
    
    // Use chat/completions format with messages array
    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": false,
        "temperature": 0.1,
        "num_predict": 2048,
    });
    
    let response = request_builder
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Summarization request failed: {}", e))?;
    
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Summarization API error: {} - {}", status, error_text));
    }
    
    let json_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let summary = json_response
        .get("message")
        .and_then(|msg| msg.get("content"))
        .and_then(|content| content.as_str())
        .unwrap_or("")
        .to_string();
        
    Ok(summary)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .manage(AudioState {
        mic_stream: Mutex::new(None),
        system_stream: Mutex::new(None),
        is_recording: AtomicBool::new(false),
        capture_mode: Mutex::new(String::new()),
        config: Mutex::new(AppConfig::default()),
    })
    .setup(|app| {
        // Load config from YAML file
        let config = load_config(app.handle());
        let state = app.state::<AudioState>();
        *state.config.lock().unwrap() = config;
        
        if cfg!(debug_assertions) {
        app.handle().plugin(
            tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
        }
        Ok(())
    })
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![
        get_audio_devices,
        get_system_audio_devices,
        start_audio_capture,
        start_dual_audio_capture,
        stop_audio_capture,
        is_recording,
        get_capture_mode,
        get_config,
        save_config,
        get_default_config,
        save_device_settings,
        save_language,
        translate_text,
        summarize_text,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}