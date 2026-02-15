use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, serde::Serialize)]
struct AudioChunk {
    data: Vec<u8>,
    sample_rate: u32,
    channels: u16,
}

struct AudioState {
    stream: Mutex<Option<Stream>>,
    is_recording: AtomicBool,
    device_name: Mutex<Option<String>>,
}

// Safe wrapper for Stream since cpal Stream is not Send/Sync
unsafe impl Send for AudioState {}
unsafe impl Sync for AudioState {}

#[tauri::command]
fn get_audio_devices() -> Result<Vec<String>, String> {
    let host = cpal::default_host();
    let devices: Vec<String> = host
        .input_devices()
        .map_err(|e| e.to_string())?
        .filter_map(|d| d.name().ok())
        .collect();
    Ok(devices)
}

#[tauri::command]
fn get_system_audio_devices() -> Result<Vec<String>, String> {
    // On Windows, system audio requires WASAPI loopback
    // This returns available output devices that can be captured as loopback
    let host = cpal::default_host();
    let devices: Vec<String> = host
        .output_devices()
        .map_err(|e| e.to_string())?
        .filter_map(|d| d.name().ok())
        .collect();
    Ok(devices)
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

    let is_recording = Arc::new(AtomicBool::new(true));
    let app_handle_err = app.clone();
    let app_handle_data = app.clone();
    
    let err_fn = move |err: cpal::StreamError| {
        log::error!("Audio stream error: {}", err);
        let _ = app_handle_err.emit("audio-error", err.to_string());
    };

    let host = cpal::default_host();
    
    // Select device: microphone input or system audio (loopback)
    let device = if is_system_audio {
        // For system audio, we need to use the default output device (loopback)
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

    let config: cpal::SupportedStreamConfig = device.default_input_config()
        .map_err(|e| e.to_string())?
        .into();

    let stream_config: cpal::StreamConfig = config.clone().into();
    let sample_rate = config.sample_rate().0;
    let channels = config.channels();

    let stream = match config.sample_format() {
        SampleFormat::F32 => {
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _: &_| {
                    if !is_recording.load(Ordering::SeqCst) { return; }
                    // Convert f32 to bytes
                    let bytes: Vec<u8> = data.iter()
                        .flat_map(|&s| s.to_le_bytes())
                        .collect();
                    let _ = app_handle_data.emit("audio-chunk", AudioChunk {
                        data: bytes,
                        sample_rate,
                        channels,
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
                    let _ = app_handle_data.emit("audio-chunk", AudioChunk {
                        data: bytes,
                        sample_rate,
                        channels,
                    });
                },
                err_fn,
                None,
            )
        }
        _ => return Err("Unsupported sample format".to_string()),
    }.map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;
    
    *state.stream.lock().unwrap() = Some(stream);
    state.is_recording.store(true, Ordering::SeqCst);
    *state.device_name.lock().unwrap() = device_name;
    
    Ok(())
}

#[tauri::command]
async fn stop_audio_capture(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    state.is_recording.store(false, Ordering::SeqCst);
    *state.stream.lock().unwrap() = None;
    *state.device_name.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
fn is_recording(app: AppHandle) -> bool {
    let state = app.state::<AudioState>();
    state.is_recording.load(Ordering::SeqCst)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .manage(AudioState {
        stream: Mutex::new(None),
        is_recording: AtomicBool::new(false),
        device_name: Mutex::new(None),
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
        stop_audio_capture,
        is_recording,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
