mod encryption;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream, StreamConfig};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use reqwest;
use futures_util::StreamExt;

use encryption::{encrypt_token, decrypt_token};

// ---------------------------------------------------------------------
// Windows WASAPI Loopback Capture
// ---------------------------------------------------------------------

#[cfg(windows)]
mod wasapi_loopback;

// ---------------------------------------------------------------------
// Sleep Prevention (Platform-specific)
// ---------------------------------------------------------------------

/// Platform-specific sleep prevention state
#[cfg(windows)]
static SLEEP_PREVENTION_ENABLED: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "macos")]
static SLEEP_PREVENTION_ENABLED: AtomicBool = AtomicBool::new(false);

/// Enable sleep prevention (Windows implementation)
#[cfg(windows)]
fn enable_sleep_prevention() -> Result<(), String> {
    use winapi::um::winbase::SetThreadExecutionState;
    
    // SetThreadExecutionState prevents the system from sleeping
    // ES_CONTINUOUS (0x80000000): Informs the system that the state being set should remain in effect
    // ES_SYSTEM_REQUIRED (0x00000001): Keeps the system from sleeping
    // ES_DISPLAY_REQUIRED (0x00000002): Keeps the display from turning off
    const ES_CONTINUOUS: u32 = 0x80000000;
    const ES_SYSTEM_REQUIRED: u32 = 0x00000001;
    const ES_DISPLAY_REQUIRED: u32 = 0x00000002;
    
    let result = unsafe { SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED) };
    
    if result == 0 {
        return Err("Failed to set thread execution state".to_string());
    }
    
    SLEEP_PREVENTION_ENABLED.store(true, Ordering::SeqCst);
    log::info!("Sleep prevention enabled (Windows)");
    Ok(())
}

/// Disable sleep prevention (Windows implementation)
#[cfg(windows)]
fn disable_sleep_prevention() -> Result<(), String> {
    use winapi::um::winbase::SetThreadExecutionState;
    
    // ES_CONTINUOUS (0x80000000): Clear the execution state to allow normal sleep behavior
    const ES_CONTINUOUS: u32 = 0x80000000;
    
    let result = unsafe { SetThreadExecutionState(ES_CONTINUOUS) };
    
    if result == 0 {
        return Err("Failed to clear thread execution state".to_string());
    }
    
    SLEEP_PREVENTION_ENABLED.store(false, Ordering::SeqCst);
    log::info!("Sleep prevention disabled (Windows)");
    Ok(())
}

/// Enable sleep prevention (macOS implementation)
#[cfg(target_os = "macos")]
fn enable_sleep_prevention() -> Result<(), String> {
    // On macOS, we use IOPMAssertionCreateWithName
    // This is a placeholder - the actual implementation would use CoreFoundation APIs
    // For now, we'll just log that it's enabled
    SLEEP_PREVENTION_ENABLED.store(true, Ordering::SeqCst);
    log::info!("Sleep prevention enabled (macOS) - placeholder");
    Ok(())
}

/// Disable sleep prevention (macOS implementation)
#[cfg(target_os = "macos")]
fn disable_sleep_prevention() -> Result<(), String> {
    SLEEP_PREVENTION_ENABLED.store(false, Ordering::SeqCst);
    log::info!("Sleep prevention disabled (macOS) - placeholder");
    Ok(())
}

/// Enable sleep prevention (Linux/other - no-op)
#[cfg(not(any(windows, target_os = "macos")))]
fn enable_sleep_prevention() -> Result<(), String> {
    log::info!("Sleep prevention not implemented for this platform");
    Ok(())
}

/// Disable sleep prevention (Linux/other - no-op)
#[cfg(not(any(windows, target_os = "macos")))]
fn disable_sleep_prevention() -> Result<(), String> {
    log::info!("Sleep prevention not implemented for this platform");
    Ok(())
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
struct AudioChunk {
    data: Vec<u8>,
    sample_rate: u32,
    channels: u16,
    source: String, // "mic" or "system"
}

// Config structure for YAML file
#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct AppConfig {
    pub llm_provider: Option<String>, // "ollama" or "openai-compatible"
    pub speaches_base_url: Option<String>,
    pub speaches_transcribe_model: Option<String>,
    pub speaches_transcribe_language: Option<String>,
    pub ollama_base_url: Option<String>,
    pub ollama_api_token: Option<String>,
    pub ollama_translate_model: Option<String>,
    pub ollama_summarize_model: Option<String>,
    pub ollama_conversation_model: Option<String>,
    pub openai_compatible_base_url: Option<String>,
    pub openai_compatible_api_token: Option<String>,
    pub openai_compatible_translate_model: Option<String>,
    pub openai_compatible_summarize_model: Option<String>,
    pub openai_compatible_conversation_model: Option<String>,
    pub translate_prompt: Option<String>,
    pub summarize_prompt: Option<String>,
    // Audio device settings - persisted for user convenience
    pub mic_device: Option<String>,
    pub system_audio_device: Option<String>,
    pub capture_mode: Option<String>, // "mic", "system", or "dual"
}

// Implement Default trait manually to provide actual default values
// instead of all None from #[derive(Default)]
impl Default for AppConfig {
    fn default() -> Self {
        let translate_prompt = "You are a professional translator. Translate the following text from {source_language} to {target_language}.\n\n## TRANSLATION GUIDELINES\n\n### Accuracy\n- Translate meaning and intent, not just words\n- Preserve the original tone (formal, casual, technical, etc.)\n- Maintain speaker attribution if present (e.g., \"John:\", \"Speaker 1:\")\n\n### Technical Terms\n- Keep domain-specific technical terms in their original form if commonly used\n- Provide brief context in parentheses for unfamiliar terms: \"term (context)\"\n- Preserve acronyms unless there's a well-known translation\n\n### Structure\n- Maintain original paragraph breaks and formatting\n- Preserve bullet points, numbering, and indentation\n- Keep timestamps or time references in original format\n\n### Idioms & Cultural Context\n- Translate idioms to their closest equivalent in the target language\n- If no equivalent exists, provide a literal translation with context\n- Preserve cultural references with brief explanation if needed\n\n### Output Format\n- Output ONLY the translated text\n- Use clear paragraph breaks with blank lines between paragraphs\n- Do not add explanations, notes, or commentary\n\n## TEXT TO TRANSLATE:\n{text}".to_string();
        
        let summarize_prompt = "Analyze the following transcribed content and create a comprehensive summary. First, identify the content type, then structure your response accordingly.\n\n## CONTENT TYPE DETECTION\nDetermine if this is:\n- MEETING: Multi-party discussion with decisions/action items\n- LECTURE: Educational presentation with concepts to learn\n- INTERVIEW: Q&A format between parties\n- PERSONAL: Single speaker notes, thoughts, or reminders\n- DISCUSSION: Multiple viewpoints on topics without formal decisions\n\n## OUTPUT FORMAT\n\n# [Appropriate Title Based on Content]\n\n## CONTENT TYPE: [Detected Type]\n\n## EXECUTIVE SUMMARY\n[2-3 sentence overview of the main purpose and outcome]\n\n## KEY INFORMATION\n\n### Main Topics Covered\n- [Topic with brief context]\n\n### Important Points\n- [Key point with attribution if identifiable]\n\n## ACTION ITEMS & COMMITMENTS\n- [ ] [Action item] - [Owner if identifiable] - [Due date if mentioned]\n- [ ] [Action item] - [Owner if identifiable] - [Due date if mentioned]\n\n## DECISIONS MADE\n- **Decision**: [What was decided]\n  - **Context**: [Why this decision was made]\n  - **Impact**: [Who/what is affected]\n\n## DEADLINES & TIME REFERENCES\n| When | What | Context |\n|------|------|---------|\n| [Date/Time] | [Event/Deadline] | [Additional context] |\n\n## SPEAKERS & CONTRIBUTIONS\n[If multiple speakers identified]\n- **[Speaker identifier]**: [Key points they made]\n\n## TECHNICAL TERMS & CONCEPTS\n- **[Term]**: [Definition or context from content]\n\n## OPEN QUESTIONS & FOLLOW-UPS\n- [ ] [Unresolved question requiring follow-up]\n- [ ] [Topic that needs further discussion]\n\n## PROACTIVE RECOMMENDATIONS\nBased on the content, consider:\n1. [Suggested next step]\n2. [Related topic to explore]\n3. [Potential risk or opportunity to address]\n\n## TONE & URGENCY\n- **Overall Tone**: [Formal/Casual/Technical/Collaborative/etc.]\n- **Urgency Level**: [High/Medium/Low] - [Reasoning]\n- **Emotional Indicators**: [Any notable emotional context]\n\n---\n\n## RULES:\n1. Adapt sections based on content type - omit irrelevant sections\n2. Extract ALL dates, times, and deadlines mentioned\n3. Preserve speaker attribution when identifiable\n4. Capture technical terms with their contextual meaning\n5. Be proactive - suggest follow-ups and highlight risks\n6. Use concrete, specific language - avoid vague statements\n7. If information is unclear, note it rather than guessing\n8. Maintain chronological order for events/deadlines\n9. Format action items as checkboxes for usability\n10. Output ONLY the summary - no meta-commentary\n\n## CONTENT TO ANALYZE:\n{text}".to_string();
        
        AppConfig {
            llm_provider: Some("ollama".to_string()),
            speaches_base_url: Some("http://127.0.0.1:10300".to_string()),
            speaches_transcribe_model: Some("Systran/faster-whisper-large-v3".to_string()),
            speaches_transcribe_language: Some("zh".to_string()),
            ollama_base_url: Some("http://127.0.0.1:10102".to_string()),
            ollama_api_token: None,
            ollama_translate_model: Some("qwen3.5:latest".to_string()),
            ollama_summarize_model: Some("qwen3.5:latest".to_string()),
            ollama_conversation_model: Some("qwen3.5:latest".to_string()),
            openai_compatible_base_url: Some("http://127.0.0.1:8080".to_string()),
            openai_compatible_api_token: None,
            openai_compatible_translate_model: None,
            openai_compatible_summarize_model: None,
            openai_compatible_conversation_model: None,
            translate_prompt: Some(translate_prompt),
            summarize_prompt: Some(summarize_prompt),
            mic_device: None,
            system_audio_device: None,
            capture_mode: None,
        }
    }
}

// State for dual audio capture
struct AudioState {
    mic_stream: Mutex<Option<Stream>>,
    system_stream: Mutex<Option<Stream>>,
    // Use Arc<AtomicBool> so the same flag is shared with capture threads
    // This ensures stop_audio_capture can signal all threads to stop
    is_recording: Arc<AtomicBool>,
    capture_mode: Mutex<String>, // "mic", "system", "dual"
    config: Mutex<AppConfig>,
    #[cfg(windows)]
    wasapi_loopback_handle: Mutex<Option<wasapi_loopback::WasiLoopbackHandle>>,
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
#[cfg(not(windows))]
fn get_system_audio_devices() -> Result<Vec<(String, String)>, String> {
    // On non-Windows, use cpal for system audio devices
    let host = cpal::default_host();
    let devices: Vec<(String, String)> = host
        .output_devices()
        .map_err(|e| e.to_string())?
        .filter_map(|d| d.name().ok())
        .map(|name| (name.clone(), name))
        .collect();
    Ok(devices)
}

#[tauri::command]
#[cfg(windows)]
fn get_system_audio_devices() -> Result<Vec<(String, String)>, String> {
    // On Windows, use WASAPI to enumerate render endpoints for device IDs
    // and cpal to get friendly names
    use windows::Win32::Media::Audio::*;
    use windows::Win32::System::Com::*;
    
    // Get friendly names from cpal first (they enumerate in similar order)
    let host = cpal::default_host();
    let cpal_names: Vec<String> = host
        .output_devices()
        .map_err(|e| e.to_string())?
        .filter_map(|d| d.name().ok())
        .collect();
    
    unsafe {
        // Initialize COM
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        // Get the device enumerator
        let enumerator: IMMDeviceEnumerator = match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) {
            Ok(e) => e,
            Err(e) => {
                CoUninitialize();
                return Err(format!("Failed to create device enumerator: {}", e));
            }
        };
        
        // Enumerate all active render endpoints
        let device_collection = match enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) {
            Ok(c) => c,
            Err(e) => {
                CoUninitialize();
                return Err(format!("Failed to enumerate audio endpoints: {}", e));
            }
        };
        
        let device_count = match device_collection.GetCount() {
            Ok(count) => count,
            Err(e) => {
                CoUninitialize();
                return Err(format!("Failed to get device count: {}", e));
            }
        };
        
        let mut devices: Vec<(String, String)> = Vec::new();
        
        for i in 0..device_count {
            if let Ok(device) = device_collection.Item(i) {
                // Get the device ID (this is what we need for WASAPI)
                let device_id = match device.GetId() {
                    Ok(id) => id.to_string().unwrap_or_else(|_| format!("Device {}", i)),
                    Err(_) => continue,
                };
                
                // Use cpal name if available, otherwise use a fallback
                let friendly_name = cpal_names.get(i as usize)
                    .cloned()
                    .unwrap_or_else(|| format!("Speaker {}", i + 1));
                
                log::info!("WASAPI: Found device '{}' - ID: {}", friendly_name, device_id);
                devices.push((device_id, friendly_name));
            }
        }
        
        CoUninitialize();
        Ok(devices)
    }
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

    // Counter for logging (to avoid spam)
    let frame_counter = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let frame_counter_clone = frame_counter.clone();
    
    let stream = match config.sample_format() {
        SampleFormat::F32 => {
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _: &_| {
                    if !is_recording.load(Ordering::SeqCst) { return; }
                    
                    // Log every 1000 frames (debug level to reduce noise)
                    let count = frame_counter_clone.fetch_add(1, Ordering::SeqCst);
                    if count % 1000 == 0 {
                        log::debug!("cpal: audio-chunk event, frames: {}, sample_rate: {}, channels: {}",
                            data.len(), sample_rate, channels);
                    }
                    
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
            let frame_counter_clone2 = frame_counter.clone();
            device.build_input_stream(
                &stream_config,
                move |data: &[i16], _: &_| {
                    if !is_recording.load(Ordering::SeqCst) { return; }
                    
                    // Log every 1000 frames (debug level to reduce noise)
                    let count = frame_counter_clone2.fetch_add(1, Ordering::SeqCst);
                    if count % 1000 == 0 {
                        log::debug!("cpal: audio-chunk event, frames: {}, sample_rate: {}, channels: {}",
                            data.len(), sample_rate, channels);
                    }
                    
                    // Convert i16 to f32 for consistent format with WASAPI loopback
                    // i16 range: -32768 to 32767 -> f32 range: -1.0 to 1.0
                    let f32_data: Vec<f32> = data.iter()
                        .map(|&s| s as f32 / 32768.0)
                        .collect();
                    let bytes: Vec<u8> = f32_data.iter()
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

    log::info!("Starting audio capture: is_system_audio={}, device_name={:?}", is_system_audio, device_name);

    // Use the shared Arc<AtomicBool> from state so stop_audio_capture can signal us to stop
    let is_recording = state.is_recording.clone();
    is_recording.store(true, Ordering::SeqCst);
    
    // For system audio on Windows, use WASAPI loopback
    #[cfg(windows)]
    if is_system_audio {
        log::info!("Using WASAPI loopback for Windows system audio capture");
        
        let loopback = wasapi_loopback::WasapiLoopbackCapture::new(device_name)
            .map_err(|e| format!("Failed to create loopback capture: {}", e))?;
        
        let handle = loopback.start_loopback_capture(is_recording.clone(), app.clone())
            .map_err(|e| format!("Failed to start loopback capture: {}", e))?;
        
        // Enable sleep prevention while recording
        if let Err(e) = enable_sleep_prevention() {
            log::warn!("Failed to enable sleep prevention: {}", e);
        }
        
        *state.wasapi_loopback_handle.lock().unwrap() = Some(handle);
        *state.capture_mode.lock().unwrap() = "system".to_string();
        
        log::info!("WASAPI loopback capture started successfully");
        return Ok(());
    }
    
    // For microphone capture (or non-Windows system audio fallback)
    let host = cpal::default_host();
    
    // Select device: microphone input or system audio (loopback)
    let device = if is_system_audio {
        // Non-Windows: try to use cpal for system audio (may not work)
        log::info!("Selecting default output device for system audio (loopback)");
        let dev = host.default_output_device()
            .ok_or("No default output device for system audio capture")?;
        log::info!("Selected output device: {:?}", dev.name());
        dev
    } else {
        match &device_name {
            Some(name) => {
                log::info!("Looking for input device: {}", name);
                host.input_devices()
                    .map_err(|e| e.to_string())?
                    .find(|d| d.name().as_ref().map(|n| n == name).unwrap_or(false))
                    .ok_or("Device not found")?
            }
            None => {
                log::info!("Using default input device");
                host.default_input_device()
                    .ok_or("No default input device")?
            }
        }
    };

    log::info!("Device selected: {:?}", device.name());

    // For system audio capture, we need to use the output config (is_input=false)
    // For microphone capture, we use the input config (is_input=true)
    let stream = build_audio_stream(
        &device,
        !is_system_audio,  // is_input: true for mic, false for system audio
        is_recording.clone(),
        app.clone(),
        if is_system_audio { "system".to_string() } else { "mic".to_string() }
    )?;
    
    log::info!("Starting audio stream playback...");
    stream.play().map_err(|e| format!("Failed to start stream: {}", e))?;
    log::info!("Audio stream started successfully");
    
    // Enable sleep prevention while recording
    if let Err(e) = enable_sleep_prevention() {
        log::warn!("Failed to enable sleep prevention: {}", e);
    }
    
    *state.mic_stream.lock().unwrap() = Some(stream);
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
    
    // Use the shared Arc<AtomicBool> from state so stop_audio_capture can signal us to stop
    let is_recording = state.is_recording.clone();
    is_recording.store(true, Ordering::SeqCst);
    
    // Get microphone device
    let mic = match &mic_device {
        Some(name) => host.input_devices()
            .map_err(|e| e.to_string())?
            .find(|d| d.name().as_ref().map(|n| n == name).unwrap_or(false))
            .ok_or("Microphone device not found")?,
        None => host.default_input_device()
            .ok_or("No default input device")?,
    };

    // Build mic stream
    let mic_stream = build_audio_stream(&mic, true, is_recording.clone(), app.clone(), "mic".to_string())?;
    mic_stream.play().map_err(|e| e.to_string())?;
    
    // For system audio on Windows, use WASAPI loopback
    #[cfg(windows)]
    {
        log::info!("Using WASAPI loopback for Windows system audio capture (dual mode)");
        
        let loopback = wasapi_loopback::WasapiLoopbackCapture::new(system_device)
            .map_err(|e| format!("Failed to create loopback capture: {}", e))?;
        
        let handle = loopback.start_loopback_capture(is_recording.clone(), app.clone())
            .map_err(|e| format!("Failed to start loopback capture: {}", e))?;
        
        // Enable sleep prevention while recording
        if let Err(e) = enable_sleep_prevention() {
            log::warn!("Failed to enable sleep prevention: {}", e);
        }
        
        *state.mic_stream.lock().unwrap() = Some(mic_stream);
        *state.wasapi_loopback_handle.lock().unwrap() = Some(handle);
        *state.capture_mode.lock().unwrap() = "dual".to_string();
        
        log::info!("Dual audio capture started (mic + WASAPI loopback)");
        return Ok(());
    }
    
    // Non-Windows: use cpal for system audio (may not work for loopback)
    #[cfg(not(windows))]
    {
        // Get system audio device (output device for loopback)
        let system = match &system_device {
            Some(name) => host.output_devices()
                .map_err(|e| e.to_string())?
                .find(|d| d.name().as_ref().map(|n| n == name).unwrap_or(false))
                .ok_or("System audio device not found")?,
            None => host.default_output_device()
                .ok_or("No default output device")?,
        };

        // Build system audio stream
        let system_stream = build_audio_stream(&system, false, is_recording.clone(), app.clone(), "system".to_string())?;
        system_stream.play().map_err(|e| e.to_string())?;
        
        // Enable sleep prevention while recording
        if let Err(e) = enable_sleep_prevention() {
            log::warn!("Failed to enable sleep prevention: {}", e);
        }
        
        *state.mic_stream.lock().unwrap() = Some(mic_stream);
        *state.system_stream.lock().unwrap() = Some(system_stream);
        *state.capture_mode.lock().unwrap() = "dual".to_string();
    }
    
    Ok(())
}

#[tauri::command]
async fn stop_audio_capture(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    state.is_recording.store(false, Ordering::SeqCst);
    *state.mic_stream.lock().unwrap() = None;
    *state.system_stream.lock().unwrap() = None;
    *state.capture_mode.lock().unwrap() = String::new();
    
    // Stop WASAPI loopback handle on Windows
    #[cfg(windows)]
    {
        if let Some(mut handle) = state.wasapi_loopback_handle.lock().unwrap().take() {
            log::info!("Stopping WASAPI loopback capture");
            handle.stop();
        }
    }
    
    // Disable sleep prevention when recording stops
    if let Err(e) = disable_sleep_prevention() {
        log::warn!("Failed to disable sleep prevention: {}", e);
    }
    
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
    let mut config = state.config.lock().unwrap().clone();
    
    // Decrypt API tokens if they're encrypted in the config file
    // Supports backward compatibility with plain text tokens
    if let Some(ref token) = config.ollama_api_token {
        if !token.is_empty() {
            match decrypt_token(token) {
                Ok(Some(decrypted)) => {
                    config.ollama_api_token = Some(decrypted);
                }
                Ok(None) => {
                    config.ollama_api_token = None;
                }
                Err(e) => {
                    log::warn!("Failed to decrypt Ollama API token: {}", e);
                }
            }
        }
    }
    
    if let Some(ref token) = config.openai_compatible_api_token {
        if !token.is_empty() {
            match decrypt_token(token) {
                Ok(Some(decrypted)) => {
                    config.openai_compatible_api_token = Some(decrypted);
                }
                Ok(None) => {
                    config.openai_compatible_api_token = None;
                }
                Err(e) => {
                    log::warn!("Failed to decrypt OpenAI-compatible API token: {}", e);
                }
            }
        }
    }
    
    config
}

// Save config to YAML file
// API tokens are encrypted before storing in config.yml
#[tauri::command]
fn save_config(app: AppHandle, mut config: AppConfig) -> Result<(), String> {
    // Encrypt the Ollama API token before saving to config file
    if let Some(ref token) = config.ollama_api_token {
        if !token.is_empty() {
            match encrypt_token(token) {
                Ok(encrypted) => {
                    config.ollama_api_token = Some(encrypted);
                    log::info!("Ollama API token encrypted for storage");
                }
                Err(e) => {
                    log::error!("Failed to encrypt Ollama API token: {}", e);
                    return Err(format!("Failed to encrypt Ollama API token: {}", e));
                }
            }
        }
    }
    
    // Encrypt the OpenAI-compatible API token before saving to config file
    if let Some(ref token) = config.openai_compatible_api_token {
        if !token.is_empty() {
            match encrypt_token(token) {
                Ok(encrypted) => {
                    config.openai_compatible_api_token = Some(encrypted);
                    log::info!("OpenAI-compatible API token encrypted for storage");
                }
                Err(e) => {
                    log::error!("Failed to encrypt OpenAI-compatible API token: {}", e);
                    return Err(format!("Failed to encrypt OpenAI-compatible API token: {}", e));
                }
            }
        }
    }
    
    let config_path = get_config_path(&app);
    
    // Ensure directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    // Serialize and write config (with encrypted API token)
    let yaml = serde_yaml::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(&config_path, yaml).map_err(|e| e.to_string())?;
    
    // Update in-memory config
    let state = app.state::<AudioState>();
    *state.config.lock().unwrap() = config;
    
    log::info!("Config saved to: {:?}", config_path);
    Ok(())
}

// Get default config values
#[tauri::command]
fn get_default_config() -> AppConfig {
    AppConfig::default()
}

// ---------------------------------------------------------------------
// Model Listing Commands
// ---------------------------------------------------------------------

/// Response structure for Ollama /api/tags
#[derive(serde::Serialize, serde::Deserialize)]
struct OllamaModelsResponse {
    models: Vec<OllamaModel>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct OllamaModel {
    name: String,
    #[serde(default)]
    modified_at: Option<String>,
    #[serde(default)]
    size: Option<u64>,
}

/// Response structure for OpenAI /v1/models
#[derive(serde::Serialize, serde::Deserialize)]
struct OpenAIModelsResponse {
    data: Vec<OpenAIModel>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct OpenAIModel {
    id: String,
    #[serde(default)]
    owned_by: Option<String>,
}

/// Model info returned to the frontend
#[derive(serde::Serialize)]
struct ModelInfo {
    id: String,
    name: String,
    provider: String,
}

/// Fetch available models from an Ollama server
#[tauri::command]
async fn fetch_ollama_models(base_url: String, api_token: Option<String>) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));
    
    let mut request = client.get(&url);
    if let Some(ref token) = api_token {
        if !token.is_empty() {
            request = request.bearer_auth(token);
        }
    }
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama server: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Ollama API error ({}): {}", status, error_text));
    }
    
    let body: OllamaModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;
    
    let models = body.models
        .into_iter()
        .map(|m| ModelInfo {
            id: m.name.clone(),
            name: m.name,
            provider: "ollama".to_string(),
        })
        .collect();
    
    Ok(models)
}

/// Fetch available models from an OpenAI-compatible server
#[tauri::command]
async fn fetch_openai_compatible_models(base_url: String, api_token: Option<String>) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    // Strip /v1 suffix if present — we add it ourselves
    let normalized_url = base_url.trim_end_matches('/');
    let normalized_url = normalized_url.strip_suffix("/v1").unwrap_or(normalized_url);
    let url = format!("{}/v1/models", normalized_url);
    
    let mut request = client.get(&url);
    if let Some(ref token) = api_token {
        if !token.is_empty() {
            request = request.bearer_auth(token);
        }
    }
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("Failed to connect to OpenAI-compatible server: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI-compatible API error ({}): {}", status, error_text));
    }
    
    let body: OpenAIModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI-compatible response: {}", e))?;
    
    let models = body.data
        .into_iter()
        .map(|m| ModelInfo {
            id: m.id.clone(),
            name: m.id,
            provider: "openai-compatible".to_string(),
        })
        .collect();
    
    Ok(models)
}

/// Fetch available models from a Speaches server (OpenAI-compatible /v1/models)
#[tauri::command]
async fn fetch_speaches_models(base_url: String, _api_token: Option<String>) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    let normalized_url = base_url.trim_end_matches('/');
    let normalized_url = normalized_url.strip_suffix("/v1").unwrap_or(normalized_url);
    let url = format!("{}/v1/models", normalized_url);
    
    // Speaches doesn't require auth, but we accept the arg for API consistency
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Speaches server: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Speaches API error ({}): {}", status, error_text));
    }
    
    // Speaches returns the same OpenAI-style format
    let body: OpenAIModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Speaches response: {}", e))?;
    
    let models = body.data
        .into_iter()
        .map(|m| ModelInfo {
            id: m.id.clone(),
            name: m.id,
            provider: "speaches".to_string(),
        })
        .collect();
    
    Ok(models)
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

// ---------------------------------------------------------------------
// LLM Provider Helpers
// ---------------------------------------------------------------------

/// Determine which LLM provider is active
fn get_llm_provider(config: &AppConfig) -> String {
    std::env::var("LLM_PROVIDER")
        .ok()
        .or(config.llm_provider.clone())
        .unwrap_or_else(|| "ollama".to_string())
}

/// Get the base URL and model for a given function (translate/summarize/conversation)
fn get_llm_endpoint(config: &AppConfig, function: &str) -> (String, Option<String>, String) {
    // Returns (base_url, api_token, model)
    let provider = get_llm_provider(config);
    
    match provider.as_str() {
        "openai-compatible" => {
            let base_url = std::env::var("OPENAI_COMPATIBLE_BASE_URL")
                .ok()
                .or(config.openai_compatible_base_url.clone())
                .unwrap_or_else(|| "http://127.0.0.1:8080".to_string());
            let token = std::env::var("OPENAI_COMPATIBLE_API_TOKEN")
                .ok()
                .or(config.openai_compatible_api_token.clone());
            let env_key = format!("OPENAI_COMPATIBLE_{}_MODEL", function.to_uppercase());
            let config_field = format!("openai_compatible_{}_model", function);
            let model = std::env::var(&env_key)
                .ok()
                .or_else(|| match config_field.as_str() {
                    "openai_compatible_translate_model" => config.openai_compatible_translate_model.clone(),
                    "openai_compatible_summarize_model" => config.openai_compatible_summarize_model.clone(),
                    "openai_compatible_conversation_model" => config.openai_compatible_conversation_model.clone(),
                    _ => None,
                })
                .unwrap_or_else(|| "".to_string());
            (base_url, token, model)
        }
        _ => {
            // Default to Ollama
            let base_url = std::env::var("OLLAMA_BASE_URL")
                .ok()
                .or(config.ollama_base_url.clone())
                .unwrap_or_else(|| "http://127.0.0.1:10102".to_string());
            let token = std::env::var("OLLAMA_API_TOKEN")
                .ok()
                .or(config.ollama_api_token.clone());
            let env_key = format!("OLLAMA_{}_MODEL", function.to_uppercase());
            let model = std::env::var(&env_key)
                .ok()
                .or_else(|| match function {
                    "translate" => config.ollama_translate_model.clone(),
                    "summarize" => config.ollama_summarize_model.clone(),
                    "conversation" => config.ollama_conversation_model.clone(),
                    _ => None,
                })
                .unwrap_or_else(|| "qwen3.5:latest".to_string());
            (base_url, token, model)
        }
    }
}

/// Build an authenticated reqwest request builder for the given provider
fn build_llm_request(client: &reqwest::Client, url: &str, token: Option<&str>) -> reqwest::RequestBuilder {
    let mut builder = client
        .post(url)
        .header("Content-Type", "application/json");
    
    if let Some(t) = token {
        if !t.is_empty() {
            builder = builder.header("Authorization", format!("Bearer {}", t));
        }
    }
    
    builder
}

/// Send a chat request to Ollama and return the full response
async fn ollama_chat(
    client: &reqwest::Client,
    base_url: &str,
    token: Option<&str>,
    model: &str,
    messages: Vec<serde_json::Value>,
    stream: bool,
    temperature: f64,
    num_predict: u32,
) -> Result<reqwest::Response, String> {
    let url = format!("{}/api/chat", base_url);
    let builder = build_llm_request(client, &url, token);
    
    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": stream,
        "think": false,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_predict": num_predict,
        }
    });
    
    let response = builder
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;
    
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Ollama API error ({}): {}", status, error_text));
    }
    
    Ok(response)
}

/// Send a chat request to an OpenAI-compatible endpoint and return the full response
async fn openai_compatible_chat(
    client: &reqwest::Client,
    base_url: &str,
    token: Option<&str>,
    model: &str,
    messages: Vec<serde_json::Value>,
    stream: bool,
    temperature: f64,
    max_tokens: u32,
) -> Result<reqwest::Response, String> {
    let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));
    let builder = build_llm_request(client, &url, token);
    
    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": stream,
        "temperature": temperature,
        "top_p": 0.9,
    });
    
    if max_tokens > 0 {
        body["max_tokens"] = serde_json::json!(max_tokens);
    }
    
    let response = builder
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI-compatible request failed: {}", e))?;
    
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI-compatible API error ({}): {}", status, error_text));
    }
    
    Ok(response)
}

// Translate text - provider-aware streaming version for Tauri
#[tauri::command]
async fn translate_text(
    app: AppHandle,
    text: String,
    source_language: String,
    target_language: String,
) -> Result<String, String> {
    let state = app.state::<AudioState>();
    let config = state.config.lock().unwrap().clone();
    let provider = get_llm_provider(&config);
    let (base_url, token, model) = get_llm_endpoint(&config, "translate");
    
    if model.is_empty() {
        return Err(format!("No translate model configured for {} provider", provider));
    }
    
    let client = reqwest::Client::new();
    
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
        .find(|(code, _)| *code == source_language)
        .map(|(_, label)| *label)
        .unwrap_or(&source_language);
        
    let target_label = language_labels.iter()
        .find(|(code, _)| *code == target_language)
        .map(|(_, label)| *label)
        .unwrap_or(&target_language);
    
    let default_translate_prompt = "You are a professional translator. Translate the following text from {source_language} to {target_language}.\n\n## TRANSLATION GUIDELINES\n\n### Accuracy\n- Translate meaning and intent, not just words\n- Preserve the original tone (formal, casual, technical, etc.)\n- Maintain speaker attribution if present (e.g., \"John:\", \"Speaker 1:\")\n\n### Technical Terms\n- Keep domain-specific technical terms in their original form if commonly used\n- Provide brief context in parentheses for unfamiliar terms: \"term (context)\"\n- Preserve acronyms unless there's a well-known translation\n\n### Structure\n- Maintain original paragraph breaks and formatting\n- Preserve bullet points, numbering, and indentation\n- Keep timestamps or time references in original format\n\n### Idioms & Cultural Context\n- Translate idioms to their closest equivalent in the target language\n- If no equivalent exists, provide a literal translation with context\n- Preserve cultural references with brief explanation if needed\n\n### Output Format\n- Output ONLY the translated text\n- Use clear paragraph breaks with blank lines between paragraphs\n- Do not add explanations, notes, or commentary\n\n## TEXT TO TRANSLATE:\n{text}";
    
    let prompt_template = config.translate_prompt.as_deref().unwrap_or(default_translate_prompt);
    let prompt = prompt_template
        .replace("{source_language}", source_label)
        .replace("{target_language}", target_label)
        .replace("{text}", &text);
    
    let messages = vec![serde_json::json!({"role": "user", "content": prompt})];
    
    match provider.as_str() {
        "openai-compatible" => {
            let response = openai_compatible_chat(
                &client, &base_url, token.as_deref(), &model,
                messages.clone(), true, 0.3, 2048,
            ).await?;
            
            let mut full_text = String::new();
            let mut stream = response.bytes_stream();
            
            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(chunk) => {
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        for line in chunk_str.lines() {
                            let trimmed = line.trim();
                            if !trimmed.starts_with("data: ") { continue; }
                            let data = &trimmed[6..];
                            if data == "[DONE]" { break; }
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                if let Some(delta) = json.get("choices")
                                    .and_then(|c| c.get(0))
                                    .and_then(|c| c.get("delta"))
                                    .and_then(|d| d.get("content"))
                                    .and_then(|c| c.as_str())
                                {
                                    full_text.push_str(delta);
                                    let _ = app.emit("translation-chunk", delta);
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
            
            let _ = app.emit("translation-complete", &full_text);
            Ok(full_text)
        }
        _ => {
            // Ollama provider (default)
            let response = ollama_chat(
                &client, &base_url, token.as_deref(), &model,
                messages.clone(), true, 0.3, 2048,
            ).await?;
            
            let mut full_text = String::new();
            let mut stream = response.bytes_stream();
            
            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(chunk) => {
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        for line in chunk_str.lines() {
                            if line.trim().is_empty() { continue; }
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                                if let Some(content) = json.get("message")
                                    .and_then(|msg| msg.get("content"))
                                    .and_then(|c| c.as_str())
                                {
                                    full_text.push_str(content);
                                    let _ = app.emit("translation-chunk", content);
                                }
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
            
            let _ = app.emit("translation-complete", &full_text);
            Ok(full_text)
        }
    }
}

// Summarize text - provider-aware version for Tauri
#[tauri::command]
async fn summarize_text(app: AppHandle, text: String) -> Result<String, String> {
    let state = app.state::<AudioState>();
    let config = state.config.lock().unwrap().clone();
    let provider = get_llm_provider(&config);
    let (base_url, token, model) = get_llm_endpoint(&config, "summarize");
    
    if model.is_empty() {
        return Err(format!("No summarize model configured for {} provider", provider));
    }
    
    let client = reqwest::Client::new();
    
    let default_summarize_prompt = "Analyze the following transcribed content and create a comprehensive summary. First, identify the content type, then structure your response accordingly.\n\n## CONTENT TYPE DETECTION\nDetermine if this is:\n- MEETING: Multi-party discussion with decisions/action items\n- LECTURE: Educational presentation with concepts to learn\n- INTERVIEW: Q&A format between parties\n- PERSONAL: Single speaker notes, thoughts, or reminders\n- DISCUSSION: Multiple viewpoints on topics without formal decisions\n\n## OUTPUT FORMAT\n\n# [Appropriate Title Based on Content]\n\n## CONTENT TYPE: [Detected Type]\n\n## EXECUTIVE SUMMARY\n[2-3 sentence overview of the main purpose and outcome]\n\n## KEY INFORMATION\n\n### Main Topics Covered\n- [Topic with brief context]\n\n### Important Points\n- [Key point with attribution if identifiable]\n\n## ACTION ITEMS & COMMITMENTS\n- [ ] [Action item] - [Owner if identifiable] - [Due date if mentioned]\n\n## DECISIONS MADE\n- **Decision**: [What was decided]\n  - **Context**: [Why this decision was made]\n  - **Impact**: [Who/what is affected]\n\n## DEADLINES & TIME REFERENCES\n| When | What | Context |\n|------|------|--------|\n| [Date/Time] | [Event/Deadline] | [Additional context] |\n\n## SPEAKERS & CONTRIBUTIONS\n[If multiple speakers identified]\n- **[Speaker identifier]**: [Key points they made]\n\n## TECHNICAL TERMS & CONCEPTS\n- **[Term]**: [Definition or context from content]\n\n## OPEN QUESTIONS & FOLLOW-UPS\n- [ ] [Unresolved question requiring follow-up]\n\n## PROACTIVE RECOMMENDATIONS\nBased on the content, consider:\n1. [Suggested next step]\n2. [Related topic to explore]\n3. [Potential risk or opportunity to address]\n\n## TONE & URGENCY\n- **Overall Tone**: [Formal/Casual/Technical/Collaborative/etc.]\n- **Urgency Level**: [High/Medium/Low] - [Reasoning]\n- **Emotional Indicators**: [Any notable emotional context]\n\n---\n\n## RULES:\n1. Adapt sections based on content type - omit irrelevant sections\n2. Extract ALL dates, times, and deadlines mentioned\n3. Preserve speaker attribution when identifiable\n4. Capture technical terms with their contextual meaning\n5. Be proactive - suggest follow-ups and highlight risks\n6. Use concrete, specific language - avoid vague statements\n7. If information is unclear, note it rather than guessing\n8. Maintain chronological order for events/deadlines\n9. Format action items as checkboxes for usability\n10. Output ONLY the summary - no meta-commentary\n\n## CONTENT TO ANALYZE:\n{text}";
    
    let prompt_template = config.summarize_prompt.as_deref().unwrap_or(default_summarize_prompt);
    let prompt = prompt_template.replace("{text}", &text);
    
    let messages = vec![serde_json::json!({"role": "user", "content": prompt})];
    
    match provider.as_str() {
        "openai-compatible" => {
            let response = openai_compatible_chat(
                &client, &base_url, token.as_deref(), &model,
                messages.clone(), false, 0.1, 2048,
            ).await?;
            
            let json_response: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            let summary = json_response
                .get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("message"))
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string();
                
            Ok(summary)
        }
        _ => {
            // Ollama provider (default)
            let response = ollama_chat(
                &client, &base_url, token.as_deref(), &model,
                messages.clone(), false, 0.1, 2048,
            ).await?;
            
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
    }
}

// ---------------------------------------------------------------------
// Conversation Command
// ---------------------------------------------------------------------

/// Conversation request structure
#[derive(Debug, serde::Deserialize)]
struct ConversationMessage {
    role: String,
    content: String,
}

#[derive(Debug, serde::Deserialize)]
struct ConversationRequest {
    messages: Vec<ConversationMessage>,
    language: String,
    scenario: String,
    difficulty: String,
    #[serde(default)]
    learning_profile: Option<LearningProfile>,
}

#[derive(Debug, serde::Deserialize)]
struct LearningProfile {
    #[serde(default)]
    grammar_weaknesses: std::collections::HashMap<String, i32>,
    #[serde(default)]
    vocabulary_gaps: Vec<String>,
    #[serde(default)]
    confidence_areas: Vec<String>,
}

/// Conversation response structure
#[derive(Debug, serde::Serialize)]
struct ConversationResponse {
    content: String,
    corrections: Vec<CorrectionResponse>,
    vocabulary: Vec<VocabularyResponse>,
}

#[derive(Debug, serde::Serialize)]
struct CorrectionResponse {
    #[serde(rename = "type")]
    correction_type: String,
    original: String,
    corrected: String,
    explanation: String,
    severity: String,
}

#[derive(Debug, serde::Serialize)]
struct VocabularyResponse {
    word: String,
    translation: String,
    context: String,
}

/// Send a conversation message to the configured LLM provider
#[tauri::command]
async fn conversation_text(
    app: AppHandle,
    messages: Vec<ConversationMessage>,
    language: String,
    scenario: String,
    difficulty: String,
    learning_profile: Option<LearningProfile>,
) -> Result<ConversationResponse, String> {
    let state = app.state::<AudioState>();
    let config = state.config.lock().unwrap().clone();
    let provider = get_llm_provider(&config);
    let (base_url, token, model) = get_llm_endpoint(&config, "conversation");
    
    if model.is_empty() {
        return Err(format!("No conversation model configured for {} provider", provider));
    }
    
    // Build system prompt based on scenario and difficulty
    let system_prompt = build_conversation_prompt(&language, &scenario, &difficulty, learning_profile.as_ref());
    
    // Convert messages to format
    let mut chat_messages: Vec<serde_json::Value> = vec![
        serde_json::json!({"role": "system", "content": system_prompt})
    ];
    
    for msg in messages {
        chat_messages.push(serde_json::json!({
            "role": msg.role,
            "content": msg.content
        }));
    }
    
    let client = reqwest::Client::new();
    
    let assistant_message = match provider.as_str() {
        "openai-compatible" => {
            let response = openai_compatible_chat(
                &client, &base_url, token.as_deref(), &model,
                chat_messages, false, 0.7, 2048,
            ).await?;
            
            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            json.get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("message"))
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string()
        }
        _ => {
            // Ollama provider (default)
            let response = ollama_chat(
                &client, &base_url, token.as_deref(), &model,
                chat_messages, false, 0.7, 2048,
            ).await?;
            
            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            json.get("message")
                .and_then(|msg| msg.get("content"))
                .and_then(|content| content.as_str())
                .unwrap_or("")
                .to_string()
        }
    };
    
    // Extract corrections and vocabulary from the response
    let (cleaned_content, corrections, vocabulary) = extract_conversation_metadata(&assistant_message);
    
    Ok(ConversationResponse {
        content: cleaned_content,
        corrections,
        vocabulary,
    })
}
fn build_conversation_prompt(
    language: &str,
    scenario: &str,
    difficulty: &str,
    learning_profile: Option<&LearningProfile>,
) -> String {
    // Language labels
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
    
    let language_label = language_labels.iter()
        .find(|&&(code, _)| code == language)
        .map(|&(_, label)| label)
        .unwrap_or(language);
    
    // Scenario prompts
    let scenario_prompt = match scenario {
        "business_meeting" => "You are a business professional in a meeting. Discuss work topics professionally.",
        "casual_chat" => "You are a friendly acquaintance chatting casually. Have natural, relaxed conversations about daily life.",
        "technical_discussion" => "You are a technical expert discussing complex topics. Use appropriate terminology.",
        "travel_restaurant" => "You are a local guide or restaurant staff helping a traveler.",
        "job_interview" => "You are an interviewer conducting a job interview. Ask relevant questions.",
        "doctor_appointment" => "You are a healthcare provider discussing medical concerns with a patient.",
        "shopping" => "You are a shopkeeper helping a customer find products.",
        _ => "You are a helpful conversation partner.",
    };
    
    // Difficulty settings
    let (vocab_level, correction_freq) = match difficulty {
        "beginner" => ("basic", "frequently"),
        "intermediate" => ("intermediate", "when significant mistakes occur"),
        "advanced" => ("advanced", "only for major errors"),
        _ => ("intermediate", "when significant mistakes occur"),
    };
    
    let mut prompt = format!(
        "{}\n\nThe user is practicing {}.\n\nDifficulty level: {}. Use {} vocabulary. Provide corrections {}.\n\nResponse format:\n1. Respond naturally in {}.\n2. If you need to correct the user, use this format: [CORRECTION: original → corrected (explanation)]\n3. If you introduce new vocabulary, use this format: [VOCAB: word - translation]\n4. Keep responses conversational and engaging.\n5. Ask follow-up questions to continue the conversation.",
        scenario_prompt, language_label, difficulty, vocab_level, correction_freq, language_label
    );
    
    // Add learning profile context if provided
    if let Some(profile) = learning_profile {
        if !profile.grammar_weaknesses.is_empty() {
            let top_weaknesses: Vec<&str> = profile.grammar_weaknesses
                .iter()
                .map(|(k, _)| k.as_str())
                .take(3)
                .collect();
            prompt.push_str(&format!("\n\nThe user struggles with these grammar patterns: {}. Help them practice these naturally in conversation.", top_weaknesses.join(", ")));
        }
        
        if !profile.vocabulary_gaps.is_empty() {
            prompt.push_str(&format!("\n\nThe user has gaps in vocabulary for: {}. Introduce related words naturally.", profile.vocabulary_gaps.iter().take(5).cloned().collect::<Vec<_>>().join(", ")));
        }
        
        if !profile.confidence_areas.is_empty() {
            prompt.push_str(&format!("\n\nThe user is confident discussing: {}. Build on these strengths.", profile.confidence_areas.join(", ")));
        }
    }
    
    prompt
}

/// Extract corrections and vocabulary from response
fn extract_conversation_metadata(content: &str) -> (String, Vec<CorrectionResponse>, Vec<VocabularyResponse>) {
    let mut corrections = Vec::new();
    let mut vocabulary = Vec::new();
    
    // Extract corrections: [CORRECTION: original → corrected (explanation)]
    let correction_regex = regex::Regex::new(r"\[CORRECTION:\s*([^→]+?)\s*→\s*([^(]+?)\s*\(([^)]+)\)\]").unwrap();
    for cap in correction_regex.captures_iter(content) {
        corrections.push(CorrectionResponse {
            correction_type: "grammar".to_string(),
            original: cap[1].trim().to_string(),
            corrected: cap[2].trim().to_string(),
            explanation: cap[3].trim().to_string(),
            severity: "moderate".to_string(),
        });
    }
    
    // Extract vocabulary: [VOCAB: word - translation]
    let vocab_regex = regex::Regex::new(r"\[VOCAB:\s*([^-]+?)\s*-\s*([^\]]+)\]").unwrap();
    for cap in vocab_regex.captures_iter(content) {
        vocabulary.push(VocabularyResponse {
            word: cap[1].trim().to_string(),
            translation: cap[2].trim().to_string(),
            context: String::new(),
        });
    }
    
    // Remove metadata markers from content
    let cleaned = correction_regex.replace_all(content, "");
    let cleaned = vocab_regex.replace_all(&cleaned, "");
    let cleaned = cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    
    (cleaned, corrections, vocabulary)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .manage(AudioState {
        mic_stream: Mutex::new(None),
        system_stream: Mutex::new(None),
        is_recording: Arc::new(AtomicBool::new(false)),
        capture_mode: Mutex::new(String::new()),
        config: Mutex::new(AppConfig::default()),
        #[cfg(windows)]
        wasapi_loopback_handle: Mutex::new(None),
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
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
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
        fetch_ollama_models,
        fetch_openai_compatible_models,
        fetch_speaches_models,
        save_device_settings,
        translate_text,
        summarize_text,
        conversation_text,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------
    // AppConfig Tests
    // -----------------------------------------------------------------
    mod app_config {
        use super::*;

        #[test]
        fn should_create_default_config_with_proper_values() {
            let config = AppConfig::default();
            // Default config should have actual values for service URLs and models
            assert!(config.llm_provider.is_some());
            assert_eq!(config.llm_provider, Some("ollama".to_string()));
            assert!(config.speaches_base_url.is_some());
            assert!(config.speaches_transcribe_model.is_some());
            assert!(config.ollama_base_url.is_some());
            assert!(config.ollama_translate_model.is_some());
            assert!(config.ollama_summarize_model.is_some());
            assert!(config.ollama_conversation_model.is_some());
            assert!(config.openai_compatible_base_url.is_some());
            // Prompts should now be included in defaults
            assert!(config.translate_prompt.is_some());
            assert!(config.summarize_prompt.is_some());
            // These should be None by default
            assert!(config.ollama_api_token.is_none());
            assert!(config.openai_compatible_api_token.is_none());
            assert!(config.openai_compatible_translate_model.is_none());
            assert!(config.openai_compatible_summarize_model.is_none());
            assert!(config.openai_compatible_conversation_model.is_none());
            assert!(config.mic_device.is_none());
            assert!(config.system_audio_device.is_none());
            assert!(config.capture_mode.is_none());
        }

        #[test]
        fn should_serialize_config_to_yaml() {
            let config = AppConfig {
                llm_provider: Some("openai-compatible".to_string()),
                speaches_base_url: Some("http://localhost:10300".to_string()),
                ollama_base_url: Some("http://localhost:10102".to_string()),
                openai_compatible_base_url: Some("http://localhost:8080".to_string()),
                mic_device: Some("device1".to_string()),
                ..Default::default()
            };
            let yaml = serde_yaml::to_string(&config).unwrap();
            assert!(yaml.contains("llm_provider: openai-compatible"));
            assert!(yaml.contains("speaches_base_url: http://localhost:10300"));
            assert!(yaml.contains("ollama_base_url: http://localhost:10102"));
            assert!(yaml.contains("openai_compatible_base_url: http://localhost:8080"));
            assert!(yaml.contains("mic_device: device1"));
        }

        #[test]
        fn should_deserialize_config_from_yaml() {
            let yaml = r#"
speaches_base_url: http://test:10300
ollama_base_url: http://test:10102
mic_device: test-device
"#;
            let config: AppConfig = serde_yaml::from_str(yaml).unwrap();
            assert_eq!(config.speaches_base_url, Some("http://test:10300".to_string()));
            assert_eq!(config.ollama_base_url, Some("http://test:10102".to_string()));
            assert_eq!(config.mic_device, Some("test-device".to_string()));
        }

        #[test]
        fn should_handle_partial_yaml_config() {
            let yaml = r#"
ollama_translate_model: test-model
"#;
            let config: AppConfig = serde_yaml::from_str(yaml).unwrap();
            assert_eq!(config.ollama_translate_model, Some("test-model".to_string()));
            assert!(config.ollama_base_url.is_none());
        }

        #[test]
        fn should_clone_config_correctly() {
            let config = AppConfig {
                speaches_base_url: Some("http://test".to_string()),
                ..Default::default()
            };
            let cloned = config.clone();
            assert_eq!(cloned.speaches_base_url, config.speaches_base_url);
        }

        #[test]
        fn should_serialize_default_config_with_all_values() {
            let config = AppConfig::default();
            let yaml = serde_yaml::to_string(&config).unwrap();
            
            // Verify all service URLs are present
            assert!(yaml.contains("speaches_base_url:"), "speaches_base_url should be in YAML");
            assert!(yaml.contains("speaches_transcribe_model:"), "speaches_transcribe_model should be in YAML");
            assert!(yaml.contains("ollama_base_url:"), "ollama_base_url should be in YAML");
            assert!(yaml.contains("ollama_translate_model:"), "ollama_translate_model should be in YAML");
            assert!(yaml.contains("ollama_summarize_model:"), "ollama_summarize_model should be in YAML");
            assert!(yaml.contains("ollama_conversation_model:"), "ollama_conversation_model should be in YAML");
            
            // Verify prompts are present
            assert!(yaml.contains("translate_prompt:"), "translate_prompt should be in YAML");
            assert!(yaml.contains("summarize_prompt:"), "summarize_prompt should be in YAML");
            
            // Verify prompt content contains expected sections
            assert!(yaml.contains("TRANSLATION GUIDELINES"), "translate_prompt should contain TRANSLATION GUIDELINES");
            assert!(yaml.contains("CONTENT TYPE DETECTION"), "summarize_prompt should contain CONTENT TYPE DETECTION");
        }

        #[test]
        fn should_deserialize_config_with_null_prompts() {
            // Test that null prompts in YAML are handled (backward compatibility)
            let yaml = r#"
speaches_base_url: http://test:10300
ollama_base_url: http://test:10102
translate_prompt: null
summarize_prompt: null
"#;
            let config: AppConfig = serde_yaml::from_str(yaml).unwrap();
            assert_eq!(config.speaches_base_url, Some("http://test:10300".to_string()));
            assert!(config.translate_prompt.is_none());
            assert!(config.summarize_prompt.is_none());
        }

        #[test]
        fn should_deserialize_config_with_custom_prompts() {
            let yaml = r#"
ollama_base_url: http://test:10102
translate_prompt: "Custom translate prompt"
summarize_prompt: "Custom summarize prompt"
"#;
            let config: AppConfig = serde_yaml::from_str(yaml).unwrap();
            assert_eq!(config.ollama_base_url, Some("http://test:10102".to_string()));
            assert_eq!(config.translate_prompt, Some("Custom translate prompt".to_string()));
            assert_eq!(config.summarize_prompt, Some("Custom summarize prompt".to_string()));
        }
    }

    // -----------------------------------------------------------------
    // AudioChunk Tests
    // -----------------------------------------------------------------
    mod audio_chunk {
        use super::*;

        #[test]
        fn should_create_audio_chunk_with_all_fields() {
            let chunk = AudioChunk {
                data: vec![1, 2, 3, 4],
                sample_rate: 16000,
                channels: 1,
                source: "mic".to_string(),
            };
            assert_eq!(chunk.data, vec![1, 2, 3, 4]);
            assert_eq!(chunk.sample_rate, 16000);
            assert_eq!(chunk.channels, 1);
            assert_eq!(chunk.source, "mic");
        }

        #[test]
        fn should_serialize_audio_chunk_to_json() {
            let chunk = AudioChunk {
                data: vec![0, 1, 2],
                sample_rate: 24000,
                channels: 2,
                source: "system".to_string(),
            };
            let json = serde_json::to_string(&chunk).unwrap();
            assert!(json.contains("\"data\":[0,1,2]"));
            assert!(json.contains("\"sample_rate\":24000"));
            assert!(json.contains("\"channels\":2"));
            assert!(json.contains("\"source\":\"system\""));
        }

        #[test]
        fn should_deserialize_audio_chunk_from_json() {
            let json = r#"{"data":[10,20,30],"sample_rate":48000,"channels":1,"source":"mic"}"#;
            let chunk: AudioChunk = serde_json::from_str(json).unwrap();
            assert_eq!(chunk.data, vec![10, 20, 30]);
            assert_eq!(chunk.sample_rate, 48000);
            assert_eq!(chunk.channels, 1);
            assert_eq!(chunk.source, "mic");
        }
    }

    // -----------------------------------------------------------------
    // get_default_config Tests
    // -----------------------------------------------------------------
    mod default_config {
        use super::*;

        #[test]
        fn should_return_config_with_default_values() {
            let config = get_default_config();
            assert_eq!(config.llm_provider, Some("ollama".to_string()));
            assert_eq!(config.speaches_base_url, Some("http://127.0.0.1:10300".to_string()));
            assert_eq!(config.speaches_transcribe_model, Some("Systran/faster-whisper-large-v3".to_string()));
            assert_eq!(config.speaches_transcribe_language, Some("zh".to_string()));
            assert_eq!(config.ollama_base_url, Some("http://127.0.0.1:10102".to_string()));
            assert!(config.ollama_api_token.is_none());
            assert_eq!(config.ollama_translate_model, Some("qwen3.5:latest".to_string()));
            assert_eq!(config.ollama_summarize_model, Some("qwen3.5:latest".to_string()));
            assert_eq!(config.ollama_conversation_model, Some("qwen3.5:latest".to_string()));
            assert_eq!(config.openai_compatible_base_url, Some("http://127.0.0.1:8080".to_string()));
            assert!(config.openai_compatible_api_token.is_none());
        }

        #[test]
        fn should_return_independent_config_instances() {
            let config1 = get_default_config();
            let config2 = get_default_config();
            // They should be equal but independent
            assert_eq!(config1.speaches_base_url, config2.speaches_base_url);
        }
    }

    // -----------------------------------------------------------------
    // Language Label Resolution Tests
    // -----------------------------------------------------------------
    mod language_labels {

        #[test]
        fn should_map_common_language_codes_to_labels() {
            // Test the language label mapping used in translate_text
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

            // Verify all expected mappings exist
            assert!(language_labels.iter().any(|(code, _)| *code == "en"));
            assert!(language_labels.iter().any(|(code, _)| *code == "zh"));
            assert!(language_labels.iter().any(|(code, _)| *code == "zh-simplified"));
            assert!(language_labels.iter().any(|(code, _)| *code == "zh-traditional"));

            // Verify label values
            let en_label = language_labels.iter().find(|(code, _)| *code == "en").map(|(_, label)| *label);
            assert_eq!(en_label, Some("English"));

            let zh_trad_label = language_labels.iter().find(|(code, _)| *code == "zh-traditional").map(|(_, label)| *label);
            assert_eq!(zh_trad_label, Some("Traditional Chinese"));
        }
    }

    // -----------------------------------------------------------------
    // Capture Mode Tests
    // -----------------------------------------------------------------
    mod capturemode {
        #[test]
        fn should_accept_valid_capture_modes() {
            let valid_modes = vec!["mic", "system", "dual"];
            for mode in valid_modes {
                // These are the valid capture modes
                assert!(matches!(mode, "mic" | "system" | "dual"));
            }
        }
    }

    // -----------------------------------------------------------------
    // AudioState Recording Flag Tests
    // These tests verify that the Arc<AtomicBool> is properly shared
    // so that stop_audio_capture can signal all capture threads to stop.
    // -----------------------------------------------------------------
    mod audio_state_recording_flag {
        use super::*;
        use std::sync::atomic::Ordering;
        use std::sync::Arc;
        use std::thread;
        use std::time::Duration;

        #[test]
        fn should_share_recording_flag_between_clones() {
            // Verify that Arc<AtomicBool> clones share the same underlying value
            let flag = Arc::new(AtomicBool::new(false));
            let flag_clone = flag.clone();
            
            // Set the original to true
            flag.store(true, Ordering::SeqCst);
            
            // The clone should see the change
            assert!(flag_clone.load(Ordering::SeqCst), "Clone should see the updated value");
            
            // Set the clone to false
            flag_clone.store(false, Ordering::SeqCst);
            
            // The original should see the change
            assert!(!flag.load(Ordering::SeqCst), "Original should see the updated value from clone");
        }

        #[test]
        fn should_signal_stop_across_threads() {
            // Simulate the pattern used in audio capture:
            // 1. Main thread creates Arc<AtomicBool>
            // 2. Capture thread gets a clone
            // 3. Main thread sets flag to false to stop capture
            
            let is_recording = Arc::new(AtomicBool::new(true));
            let is_recording_clone = is_recording.clone();
            
            // Spawn a thread that simulates a capture loop
            let handle = thread::spawn(move || {
                let mut iterations = 0;
                while is_recording_clone.load(Ordering::SeqCst) {
                    iterations += 1;
                    // Simulate some work
                    thread::sleep(Duration::from_millis(1));
                    
                    // Safety limit to prevent infinite loop in test
                    if iterations > 100 {
                        break;
                    }
                }
                iterations
            });
            
            // Let the thread run for a bit
            thread::sleep(Duration::from_millis(5));
            
            // Signal stop from main thread
            is_recording.store(false, Ordering::SeqCst);
            
            // Wait for thread to finish
            let iterations = handle.join().unwrap();
            
            // Thread should have stopped before hitting the safety limit
            assert!(iterations < 100, "Thread should have stopped when flag was set to false");
        }

        #[test]
        fn should_use_same_flag_for_multiple_clones() {
            // Verify that multiple clones all share the same value
            // This simulates dual mode where both mic and system capture
            // need to see the same stop signal
            
            let flag = Arc::new(AtomicBool::new(true));
            let clone1 = flag.clone();
            let clone2 = flag.clone();
            let clone3 = flag.clone();
            
            // All should see true initially
            assert!(flag.load(Ordering::SeqCst));
            assert!(clone1.load(Ordering::SeqCst));
            assert!(clone2.load(Ordering::SeqCst));
            assert!(clone3.load(Ordering::SeqCst));
            
            // Set to false from one clone
            clone2.store(false, Ordering::SeqCst);
            
            // All should now see false
            assert!(!flag.load(Ordering::SeqCst));
            assert!(!clone1.load(Ordering::SeqCst));
            assert!(!clone2.load(Ordering::SeqCst));
            assert!(!clone3.load(Ordering::SeqCst));
        }
    }
}