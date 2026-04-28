# Capture Mode Switching Fix - Root Cause Analysis

## Problem Summary

When switching between audio capture modes (mic, system, dual), the mode gets "locked" after the second switch. The pattern is:
1. Start with mode A → record → stop → switch to mode B → record → **works** (switches to B)
2. Stop → switch to mode A → record → **stays locked in mode B**

## Root Cause

The issue is in the backend Rust code in [`lib.rs`](src-tauri/src/lib.rs). The `Arc<AtomicBool>` used to signal the capture thread to stop is **NOT shared** with `AudioState.is_recording`.

### The Bug

In [`start_audio_capture`](src-tauri/src/lib.rs:400-493):

```rust
async fn start_audio_capture(...) -> Result<(), String> {
    let state = app.state::<AudioState>();
    
    if state.is_recording.load(Ordering::SeqCst) {  // Checks STATE's flag
        return Err("Already recording".to_string());
    }

    let is_recording = Arc::new(AtomicBool::new(true));  // Creates NEW Arc!
    
    // For WASAPI:
    let handle = loopback.start_loopback_capture(is_recording.clone(), ...);
    // Thread checks LOCAL is_recording, NOT state.is_recording!
}
```

In [`stop_audio_capture`](src-tauri/src/lib.rs:580-603):

```rust
async fn stop_audio_capture(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    state.is_recording.store(false, Ordering::SeqCst);  // Sets STATE's flag
    // ...
    handle.stop();  // Calls join() on thread
}
```

In [`wasapi_loopback.rs`](src-tauri/src/wasapi_loopback.rs:196):

```rust
while is_recording.load(Ordering::SeqCst) {  // Checks LOCAL is_recording!
    // capture audio...
}
```

### Why Mic Capture Works But WASAPI Doesn't

**For microphone capture (cpal):**
- The stream is stored in `state.mic_stream`
- When `stop_audio_capture` sets `state.mic_stream = None`, the stream is **dropped**
- Dropping the stream stops the audio callback immediately
- The callback's `is_recording` check doesn't matter because the stream is gone

**For WASAPI system audio:**
- A thread is spawned and the handle is stored in `state.wasapi_loopback_handle`
- When `stop_audio_capture` calls `handle.stop()`, it calls `join()` to wait for the thread
- The thread checks its LOCAL `is_recording` which is **still true**
- The thread never exits the loop → `join()` blocks forever (or the thread keeps running)
- **Result: The old capture thread continues running!**

### Why It Works Once But Not Twice

1. **First recording (mode A):** Creates `is_recording_A`, starts capture
2. **First stop:** Sets `state.is_recording = false`, drops stream/handles
   - For mic: stream dropped, stops immediately
   - For WASAPI: thread may or may not stop (race condition or audio device event)
3. **Second recording (mode B):** `state.is_recording` is false (check passes), creates `is_recording_B`, starts capture
   - If old WASAPI thread is still running, we now have TWO threads emitting audio!
4. **Second stop:** Sets `state.is_recording = false`
5. **Third recording (mode A):** Creates `is_recording_C`, but old threads may still be running
   - The frontend receives audio from multiple sources, appearing "locked" to the previous mode

## Solution

Change `AudioState.is_recording` from `AtomicBool` to `Arc<AtomicBool>` so that the same flag is shared between:
1. The "already recording" check in `start_audio_capture`
2. The capture thread's loop condition
3. The `stop_audio_capture` function

### Files to Modify

1. **[`src-tauri/src/lib.rs`](src-tauri/src/lib.rs)**
   - Change `AudioState.is_recording` from `AtomicBool` to `Arc<AtomicBool>`
   - Update `start_audio_capture` to use `state.is_recording.clone()` instead of creating a new Arc
   - Update `start_dual_audio_capture` similarly
   - Update `stop_audio_capture` (no change needed, already sets to false)
   - Update `is_recording` command (no change needed, already loads)
   - Update `AudioState::default()` to create `Arc::new(AtomicBool::new(false))`

2. **[`src-tauri/src/wasapi_loopback.rs`](src-tauri/src/wasapi_loopback.rs)**
   - No changes needed (already accepts `Arc<AtomicBool>`)

### Implementation Details

```rust
// In lib.rs

struct AudioState {
    mic_stream: Mutex<Option<Stream>>,
    system_stream: Mutex<Option<Stream>>,
    is_recording: Arc<AtomicBool>,  // Changed from AtomicBool
    capture_mode: Mutex<String>,
    config: Mutex<AppConfig>,
    #[cfg(windows)]
    wasapi_loopback_handle: Mutex<Option<wasapi_loopback::WasiLoopbackHandle>>,
}

// In start_audio_capture:
async fn start_audio_capture(...) -> Result<(), String> {
    let state = app.state::<AudioState>();
    
    if state.is_recording.load(Ordering::SeqCst) {
        return Err("Already recording".to_string());
    }

    // Use the shared Arc instead of creating a new one
    let is_recording = state.is_recording.clone();
    is_recording.store(true, Ordering::SeqCst);
    
    // ... rest of the function
}

// In start_dual_audio_capture:
async fn start_dual_audio_capture(...) -> Result<(), String> {
    let state = app.state::<AudioState>();
    
    if state.is_recording.load(Ordering::SeqCst) {
        return Err("Already recording".to_string());
    }

    // Use the shared Arc instead of creating a new one
    let is_recording = state.is_recording.clone();
    is_recording.store(true, Ordering::SeqCst);
    
    // ... rest of the function
}
```

## Testing Plan

1. Start app, record in mic mode, stop
2. Switch to system mode, record, stop
3. Switch back to mic mode, record → should use mic (not system)
4. Repeat with dual mode
5. Verify logs show correct mode being used
6. Verify no orphaned threads in Task Manager

## Additional Considerations

- The `Arc<AtomicBool>` approach is thread-safe and already used for passing to capture threads
- This fix ensures all capture threads (mic cpal stream callback, WASAPI thread) check the same flag that `stop_audio_capture` sets to false
- No changes needed to frontend code