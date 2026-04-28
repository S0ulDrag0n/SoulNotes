// Windows WASAPI Loopback Capture with Device Selection
// This module captures system audio from a specific output device

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use windows::Win32::Media::Audio::*;
use windows::Win32::System::Com::*;

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
struct AudioChunk {
    pub data: Vec<u8>,
    pub sample_rate: u32,
    pub channels: u16,
    pub source: String,
}

/// WASAPI loopback capture for Windows system audio
/// This captures audio being played through an output device (speakers, headphones, etc.)
pub struct WasapiLoopbackCapture {
    device_id: Option<String>,
}

/// Get the device ID from an IMMDevice
unsafe fn get_device_id(device: &IMMDevice) -> String {
    match device.GetId() {
        Ok(id) => id.to_string().unwrap_or_else(|_| "Unknown Device".to_string()),
        Err(_) => "Unknown Device".to_string(),
    }
}

/// Try to initialize loopback on a specific device
unsafe fn try_loopback_on_device(
    device: &IMMDevice,
    device_id: &str,
) -> Result<(IAudioClient, IAudioCaptureClient, u32, u16), String> {
    // Activate the audio client with explicit type parameter
    // This is critical - without the type parameter, COM activation can return a miscast interface
    let audio_client: IAudioClient = device.Activate::<IAudioClient>(CLSCTX_ALL, None)
        .map_err(|e| format!("Failed to activate audio client: {}", e))?;
    
    // Get the mix format - this returns a pointer allocated by CoTaskMemAlloc
    // We must use this exact format for loopback capture
    // IMPORTANT: When format_tag == WAVE_FORMAT_EXTENSIBLE (65534), the structure
    // is actually WAVEFORMATEXTENSIBLE, but we pass the same pointer - WASAPI knows
    // to read the extended structure based on the format tag and cbSize fields.
    let format_ptr = audio_client.GetMixFormat()
        .map_err(|e| format!("Failed to get mix format: {}", e))?;
    
    // Read format details for later use
    // We only read fields, never copy the structure - we pass the original pointer to Initialize
    let format_ref = &*format_ptr;
    let sample_rate = format_ref.nSamplesPerSec;
    let channels = format_ref.nChannels;
    
    // Initialize with loopback flag
    // For shared-mode loopback: buffer_duration MUST be 0 to let Windows choose
    // Passing a non-zero buffer duration often triggers E_INVALIDARG on many drivers
    // OBS, Chrome, Discord, etc. all use buffer_duration = 0 for loopback
    //
    // CRITICAL: Use AUDCLNT_STREAMFLAGS_LOOPBACK from Windows crate, not a custom u32
    // CRITICAL: Use std::ptr::null() for AudioSessionGuid, not None (ABI marshaling issue)
    
    let init_result = audio_client.Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK,
        0,  // buffer_duration must be 0 for shared-mode loopback
        0,  // Periodicity must be 0 for shared mode
        format_ptr,
        Some(std::ptr::null()),  // AudioSessionGuid - explicit null pointer wrapped in Some
    );
    
    match init_result {
        Ok(()) => {
            // Get the capture client
            let capture_client: IAudioCaptureClient = audio_client.GetService()
                .map_err(|e| format!("Failed to get capture client: {}", e))?;
            
            // Start the audio stream
            audio_client.Start()
                .map_err(|e| format!("Failed to start audio client: {}", e))?;
            
            // Note: format_ptr is managed by COM, we don't need to free it manually
            // The windows crate handles this
            
            Ok((audio_client, capture_client, sample_rate, channels))
        }
        Err(e) => {
            let error_code = e.code().0 as u32;
            let error_msg = match error_code {
                0x80070057 => "E_INVALIDARG - Invalid parameter (check format, share mode, or buffer size)",
                0x80070005 => "E_ACCESSDENIED - Access denied (device may be in use)",
                0x8007000E => "E_OUTOFMEMORY - Out of memory",
                0x8000FFFF => "E_UNEXPECTED - Unexpected failure",
                0x88890008 => "AUDCLNT_E_UNSUPPORTED_FORMAT - Format not supported",
                0x88890001 => "AUDCLNT_E_NOT_INITIALIZED - Not initialized",
                0x88890004 => "AUDCLNT_E_DEVICE_INVALIDATED - Device invalidated",
                0x8889000A => "AUDCLNT_E_BUFFER_SIZE_ERROR - Buffer size error",
                0x88890016 => "AUDCLNT_E_BUFFER_SIZE_NOT_ALIGNED - Buffer size not aligned",
                _ => "Unknown error",
            };
            
            Err(format!("Loopback failed on '{}': {} (0x{:08x}) - {}", device_id, e, error_code, error_msg))
        }
    }
}

/// Get a specific device by ID, or the default render device if no ID is provided
unsafe fn get_device_by_id(device_id: Option<&str>) -> Result<IMMDevice, String> {
    // Get the device enumerator
    let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
        .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
    
    match device_id {
        Some(id) => {
            // Find the specific device by ID
            // Enumerate all active render endpoints to find the matching device
            let device_collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
                .map_err(|e| format!("Failed to enumerate audio endpoints: {}", e))?;
            
            let device_count = device_collection.GetCount()
                .map_err(|e| format!("Failed to get device count: {}", e))?;
            
            for i in 0..device_count {
                if let Ok(device) = device_collection.Item(i) {
                    let current_id = get_device_id(&device);
                    
                    if current_id == id {
                        return Ok(device);
                    }
                }
            }
            
            Err(format!("Device not found: {}", id))
        }
        None => {
            // Use the default render device
            enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
                .map_err(|e| format!("Failed to get default audio endpoint: {}", e))
        }
    }
}

impl WasapiLoopbackCapture {
    pub fn new(device_id: Option<String>) -> Result<Self, String> {
        Ok(Self { device_id })
    }

    /// Start loopback capture on the specified device (or default if None)
    /// Returns a handle that can be used to stop the capture
    pub fn start_loopback_capture(
        &self,
        is_recording: Arc<AtomicBool>,
        app_handle: AppHandle,
    ) -> Result<WasiLoopbackHandle, String> {
        // Clone device_id for the thread
        let device_id = self.device_id.clone();
        
        // Spawn a thread that will own all WASAPI objects
        let handle = std::thread::spawn(move || {
            // Initialize COM in this thread
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            
            // Get the device (specific or default)
            let device = match unsafe { get_device_by_id(device_id.as_deref()) } {
                Ok(d) => d,
                Err(e) => {
                    log::error!("WASAPI: Failed to get device: {}", e);
                    unsafe { CoUninitialize(); }
                    return;
                }
            };
            
            let actual_device_id = unsafe { get_device_id(&device) };
            
            // Initialize loopback on this device
            let capture_result = unsafe { try_loopback_on_device(&device, &actual_device_id) };
            
            // Check if we got a valid capture setup
            // Note: try_loopback_on_device returns (IAudioClient, IAudioCaptureClient, sample_rate, channels)
            let (audio_client, capture_client, sample_rate, channels) = match capture_result {
                Ok(tuple) => tuple,
                Err(e) => {
                    log::error!("WASAPI: {}", e);
                    unsafe { CoUninitialize(); }
                    return;
                }
            };
            
            // Run the capture loop
            let source = "system".to_string();
            let mut frame_count: u64 = 0;
            
            while is_recording.load(Ordering::SeqCst) {
                unsafe {
                    // Get the available packet size
                    let packet_size = capture_client.GetNextPacketSize();
                    match packet_size {
                        Ok(num_frames_in_packet) => {
                            if num_frames_in_packet == 0 {
                                // No data available, sleep briefly
                                std::thread::sleep(std::time::Duration::from_millis(1));
                                continue;
                            }
                            
                            // Get the buffer
                            let mut data_ptr: *mut u8 = std::ptr::null_mut();
                            let mut num_frames_to_read: u32 = 0;
                            let mut flags: u32 = 0;
                            
                            match capture_client.GetBuffer(
                                &mut data_ptr,
                                &mut num_frames_to_read,
                                &mut flags,
                                None,
                                None,
                            ) {
                                Ok(_) => {
                                    if num_frames_to_read > 0 && !data_ptr.is_null() {
                                        // Calculate the size of the audio data
                                        let bytes_per_sample = 4; // 32-bit float = 4 bytes
                                        let data_size = (num_frames_to_read as usize) * (channels as usize) * bytes_per_sample;
                                        
                                        // Copy the audio data
                                        let audio_data = std::slice::from_raw_parts(
                                            data_ptr,
                                            data_size
                                        );
                                        
                                        // Convert f32 to bytes and emit
                                        let bytes: Vec<u8> = audio_data.to_vec();
                                         
                                        // Log every 1000 frames (debug level to reduce noise)
                                        if frame_count % 1000 == 0 {
                                            log::debug!("WASAPI: audio-chunk event, frames: {}, sample_rate: {}, channels: {}",
                                                num_frames_to_read, sample_rate, channels);
                                        }
                                         
                                        let _ = app_handle.emit("audio-chunk", AudioChunk {
                                            data: bytes,
                                            sample_rate,
                                            channels,
                                            source: source.clone(),
                                        });
                                         
                                        frame_count += num_frames_to_read as u64;
                                    }
                                    
                                    // Release the buffer
                                    let _ = capture_client.ReleaseBuffer(num_frames_to_read);
                                }
                                Err(e) => {
                                    log::error!("WASAPI: Failed to get buffer: {}", e);
                                    std::thread::sleep(std::time::Duration::from_millis(10));
                                }
                            }
                        }
                        Err(e) => {
                            log::error!("WASAPI: Failed to get packet size: {}", e);
                            std::thread::sleep(std::time::Duration::from_millis(10));
                        }
                    }
                }
            }
            
            unsafe {
                let _ = audio_client.Stop();
                let _ = audio_client.Reset();
                CoUninitialize();
            }
        });

        Ok(WasiLoopbackHandle {
            thread_handle: Some(handle),
        })
    }
}

pub struct WasiLoopbackHandle {
    thread_handle: Option<std::thread::JoinHandle<()>>,
}

impl WasiLoopbackHandle {
    pub fn stop(&mut self) {
        // The thread will stop when is_recording is set to false
        // Just wait for it to finish
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }
}