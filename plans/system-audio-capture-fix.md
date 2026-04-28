# System Audio Capture Fix Plan

## Status: ✅ COMPLETED

All issues have been fixed and tested. See the Implementation Summary section for details.

---

## Existing Infrastructure

### Platform Detection
- [`isDesktopMode()`](src/utils/platform.ts:7) - Synchronous check for Tauri environment via `__TAURI__` global
- [`getPlatform()`](src/lib/platform.ts:46) - Returns platform adapter with `isDesktop` property
- Already integrated in [`page.tsx`](src/app/page.tsx:24), [`AudioDeviceSelector`](src/components/AudioDeviceSelector.tsx:9), and other components

### Audio Device Management
- [`useAudioDevices`](src/hooks/useAudioDevices.ts) hook - Manages device lists and capture mode selection
- [`tauriAudioDeviceService`](src/lib/tauri.ts:113) - Tauri commands for device enumeration
- Capture modes: `'microphone'`, `'system'`, `'dual'` (stored in config)

---

## Problem Analysis

### Original Bug: System Audio Captured Microphone Instead

When the user selected "System" capture mode in the Tauri desktop app, the application still captured from the microphone instead of the system audio output device.

### Root Causes Identified

#### 1. Backend Bug: `is_input` Parameter Always True

**File:** [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs:318)

The `start_audio_capture` function passed `true` for `is_input` regardless of capture mode:
```rust
// Bug: is_input was always true
let stream = build_audio_stream(&device, true, ...)?;
```

**Fix:** Pass correct `is_input` based on capture type:
```rust
let stream = build_audio_stream(&device, !is_system_audio, ...)?;
```

#### 2. cpal Doesn't Support WASAPI Loopback

The `cpal` library doesn't support WASAPI loopback capture on Windows. Even with the `is_input` fix, system audio capture wouldn't work.

**Solution:** Implemented direct WASAPI loopback capture in [`src-tauri/src/wasapi_loopback.rs`](src-tauri/src/wasapi_loopback.rs).

#### 3. Missing Frontend Integration

No hook existed to receive audio chunks from Tauri backend and process them for transcription.

**Solution:** Created [`useTauriAudioCapture`](src/hooks/useTauriAudioCapture.ts) hook.

---

## Implementation Summary

### 1. WASAPI Loopback Capture (Windows System Audio)

**File:** [`src-tauri/src/wasapi_loopback.rs`](src-tauri/src/wasapi_loopback.rs)

Implemented direct WASAPI loopback capture:
- Device enumeration with friendly names
- Loopback stream initialization with `AUDCLNT_STREAMFLAGS_LOOPBACK`
- F32 sample format capture
- Proper cleanup on stop

### 2. Device Selection

**Files:**
- [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs:248-315) - `get_system_audio_devices` command
- [`src/lib/tauri.ts`](src/lib/tauri.ts:124-132) - Frontend service

Users can now select specific output devices for system audio capture.

### 3. Audio Processing Pipeline

**File:** [`src/hooks/useTauriAudioCapture.ts`](src/hooks/useTauriAudioCapture.ts)

Implemented complete audio processing pipeline:

| Step | Description |
|------|-------------|
| Format Conversion | I16 → F32 (microphone), F32 (system) |
| Stereo-to-Mono | Average L/R channels for transcription |
| Sample Rate | Resample 48kHz → 24kHz |
| Buffering | Accumulate to 4096 samples before sending |

### 4. Per-Source Buffering (Dual Mode Fix)

**File:** [`src/hooks/useTauriAudioCapture.ts`](src/hooks/useTauriAudioCapture.ts:44-48)

In dual mode, mic and system audio use separate buffers to prevent mixing:
```typescript
const audioBuffersRef = useRef<Map<string, { chunks: Int16Array[], sampleCount: number }>>(new Map());
```

### 5. I16 Sample Format Fix

**File:** [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs:368-396)

Microphone audio can use I16 format. Convert to F32 for consistency:
```rust
SampleFormat::I16 => {
    let f32_data: Vec<f32> = data.iter()
        .map(|&s| s as f32 / 32768.0)
        .collect();
    // ...
}
```

---

## Files Modified

### Backend (Rust)
| File | Changes |
|------|---------|
| `src-tauri/src/lib.rs` | Fixed `is_input` parameter, I16→F32 conversion, device enumeration |
| `src-tauri/src/wasapi_loopback.rs` | New file - WASAPI loopback implementation |
| `src-tauri/Cargo.toml` | Added Windows dependencies |

### Frontend (TypeScript)
| File | Changes |
|------|---------|
| `src/hooks/useTauriAudioCapture.ts` | New file - Tauri audio capture hook |
| `src/lib/tauri.ts` | Added `getSystemAudioDevices` command |
| `src/app/page.tsx` | Integrated Tauri audio capture |

### Tests
| File | Changes |
|------|---------|
| `src/utils/__tests__/tauri-audio-processing.test.ts` | New file - 31 tests for audio pipeline |

---

## Technical Details

### WASAPI Loopback Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Windows Audio System                      │
├─────────────────────────────────────────────────────────────┤
│  Application → Audio API → Output Device → Speakers         │
│                              ↑                               │
│                         Loopback                             │
│                              ↓                               │
│                    WASAPI Capture                            │
│                              ↓                               │
│                    Tauri Backend                             │
│                              ↓                               │
│                    Frontend (useTauriAudioCapture)          │
│                              ↓                               │
│                    Transcription WebSocket                   │
└─────────────────────────────────────────────────────────────┘
```

### Audio Data Flow

```
WASAPI Loopback          cpal Microphone
(48kHz, Stereo, F32)    (varies, mono/stereo, I16/F32)
        │                        │
        └────────┬───────────────┘
                 ↓
         Format Detection
         (channels, sample_rate)
                 ↓
         Stereo-to-Mono (if needed)
                 ↓
         Resample to 24kHz
                 ↓
         Convert to Int16
                 ↓
         Per-Source Buffering
         (mic buffer, system buffer)
                 ↓
         Send to Transcription
         (when buffer ≥ 4096 samples)
```

---

## Tests

### Test Coverage

**File:** [`src/utils/__tests__/tauri-audio-processing.test.ts`](src/utils/__tests__/tauri-audio-processing.test.ts)

| Category | Tests | Purpose |
|----------|-------|---------|
| Stereo-to-Mono | 8 | Verify L/R channel averaging |
| Float32→Int16 | 6 | Verify PCM conversion |
| Complete Pipeline | 6 | End-to-end processing |
| Regression Tests | 11 | Prevent known issues |

### Key Regression Tests

1. **Stereo-to-mono conversion** - Ensures WASAPI stereo is converted
2. **Sample rate conversion** - Ensures 48kHz→24kHz resampling
3. **I16 format handling** - Ensures microphone I16→F32 conversion
4. **Per-source buffering** - Ensures dual mode doesn't mix audio

---

## Manual Testing Checklist

- [x] Microphone mode captures mic audio
- [x] System mode captures system audio output
- [x] Dual mode captures both mic and system separately
- [x] Device selection shows friendly names
- [x] Transcription works for all modes
- [x] No audio mixing in dual mode
- [x] I16 microphone format works

---

## Future Improvements

1. **macOS/Linux System Audio** - Currently Windows-only. Could use PulseAudio monitor sources on Linux, ScreenCaptureKit on macOS.

2. **Sample Rate Detection** - Currently assumes 48kHz for WASAPI. Could detect actual device rate.

3. **Audio Level Monitoring** - Add VU meter for visual feedback.

4. **Noise Gate** - Add optional noise gate to reduce background noise.