use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream, StreamConfig};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, serde::Serialize)]
struct AudioChunk {
    data: Vec<u8>,
    sample_rate: u32,
    channels: u16,
    source: String, // "mic" or "system"
}

// State for dual audio capture
struct AudioState {
    mic_stream: Mutex<Option<Stream>>,
    system_stream: Mutex<Option<Stream>>,
    is_recording: AtomicBool,
    capture_mode: Mutex<String>, // "mic", "system", "dual"
}

// Safe wrapper for Stream since cpal Stream is not Send/Sync
unsafe impl Send for AudioState {}
unsafe impl Sync for AudioState {}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .manage(AudioState {
        mic_stream: Mutex::new(None),
        system_stream: Mutex::new(None),
        is_recording: AtomicBool::new(false),
        capture_mode: Mutex::new(String::new()),
    })
    .setup(|app| {
        if cfg!(debug_assertions) {
        app.handle().plugin(
            tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
        }
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        get_audio_devices,
        get_system_audio_devices,
        start_audio_capture,
        start_dual_audio_capture,
        stop_audio_capture,
        is_recording,
        get_capture_mode,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
