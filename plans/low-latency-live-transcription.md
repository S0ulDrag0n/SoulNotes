# Low-Latency Live Transcription Plan

## Problem

SoulNotes feels slower than Zoom's live captions. Zoom shows words as the person speaks; SoulNotes has visible latency between speech and text appearing on screen.

## Root Cause Analysis

The current pipeline has **6 serial stages**, each adding latency:

```
Microphone → AudioContext/ScriptProcessor → VAD (optional) → Base64 encode
  → WebSocket send → Speaches/Whisper server → WebSocket receive → React render
```

Here's where time accumulates:

| Stage | Current Behavior | Estimated Latency | Issue |
|-------|-----------------|-------------------|-------|
| **Audio capture** | `ScriptProcessor` (deprecated, main-thread) | 20-60ms | Runs on main thread, blocked by React renders |
| **Audio path (web)** | Browser mic → 24kHz AudioContext → resample to 16kHz → float→int16→base64 | 10-30ms | Unnecessary resampling; Speaches supports multiple rates |
| **VAD** | Silero ONNX inference per 512-sample frame, processed sequentially | 15-40ms per chunk | Each audio chunk blocks on VAD before sending |
| **Base64 encoding** | `String.fromCharCode` byte-by-byte loop | 5-15ms per chunk | Inefficient — should use TextEncoder or chunked approach |
| **WebSocket send** | `JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 })` per chunk | 1-5ms | Fine, but JSON envelope is overhead |
| **Server processing** | Speaches Whisper model inference | 200-800ms | Network RTT + model inference; we can't control this but can optimize what we send |
| **Message parsing** | `JSON.parse` per message, then `appendTranscript` → `setTranscriptMessages` React state update | 5-16ms | Each React state update triggers re-render |
| **Translation** | Debounced at 300ms, waits for pause in transcript | 300-1500ms | Necessary for quality but contributes to perceived lag |
| **Transcript merging** | `setTranscriptMessages(prev => [...prev, newMsg])` — copies full array each time | 1-5ms | O(n) per update, gets worse over long sessions |

**Total end-to-end latency: ~550-2470ms from speech to on-screen text.**

By contrast, Zoom targets <300ms for live captions.

## Strategy: Reduce Latency at Every Stage

### Phase 1: Audio Pipeline Optimization (est. ~80-120ms saved)

#### 1.1 Replace ScriptProcessor with AudioWorklet

`ScriptProcessorNode` is deprecated and runs on the **main thread**, which means it's blocked by React renders, garbage collection, and other work. `AudioWorkletNode` runs on a dedicated audio thread and is never blocked.

**Changes:**
- Create `src/worklets/audio-processor.worklet.ts` — AudioWorklet processor that captures float32 audio and posts it to the main thread
- In `useRealtimeTranscription`, replace `ScriptProcessorNode` with `AudioWorkletNode`
- AudioWorklet posts `{ pcm16: Int16Array }` messages to the main thread via `port.onmessage`
- Main thread handler receives PCM16 directly — no more `onaudioprocess` callback on main thread

```typescript
// src/worklets/audio-processor.worklet.ts
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    // Convert to Int16 and post
    const pcm16 = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      pcm16[i] = Math.max(-1, Math.min(1, channel[i])) < 0
        ? channel[i] * 0x8000
        : channel[i] * 0x7FFF;
    }
    this.port.postMessage({ pcm16 }, [pcm16.buffer]); // Transfer, not copy
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
```

**Estimated savings:** 20-60ms (eliminating main-thread contention)

#### 1.2 Use Transferable ArrayBuffers for Base64 Encode

The current `int16ToBase64` uses `String.fromCharCode(...slice)` which is slow and allocates heavily. Replace with a `TextDecoder`-based approach or binary string chunking that avoids per-byte string concatenation.

```typescript
// Current: O(n) string concatenation per chunk
export function int16ToBase64(input: Int16Array): string {
  const byteView = new Uint8Array(input.buffer);
  let binary = '';
  const chunkSize = AUDIO_ENCODING.base64ChunkSize;
  for (let i = 0; i < byteView.length; i += chunkSize) {
    const slice = byteView.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice); // SLOW: spread + string concat
  }
  return btoa(binary);
}

// Proposed: Use btoa with binary string from Uint8Array in chunks
export function int16ToBase64(input: Int16Array): string {
  const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  // Process in 8KB chunks to avoid stack overflow on spread operator
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, bytes.length);
    binary += String.fromCharCode.apply(null, bytes.subarray(i, end));
  }
  return btoa(binary);
}
```

Wait — actually the bigger win is to **avoid base64 entirely** and send raw binary via WebSocket. But the Speaches API expects base64 in JSON, so we're stuck with it unless we switch protocols. The `apply(null, subarray)` approach is still faster than spread.

**Estimated savings:** 5-15ms per chunk

#### 1.3 Reduce Resampling Overhead

Currently: Browser mic (variable rate) → AudioContext @ 24kHz → `downsampleBuffer` (float32 linear interpolation) → int16 → base64.

The Web Audio API `AudioContext` can be created at any sample rate. Speaches/Whisper accepts 16kHz audio. We should request 16kHz directly:

```typescript
const audioContext = new AudioContext({ sampleRate: 16000 }); // instead of 24000
```

This eliminates the resampling step entirely for the web path. The `downsampleBuffer` call becomes a no-op when `inputSampleRate === targetSampleRate`.

**Note:** This changes `REALTIME_AUDIO.sampleRate` from 24000 to 16000. The Tauri/desktop path still captures at 24kHz (hardware constraint) and uses VAD's `downsample24to16`, so that path is unaffected.

**Estimated savings:** 10-30ms (eliminating resampling)

### Phase 2: VAD Pipeline Optimization (est. ~30-60ms saved)

#### 2.1 Separate VAD from Audio Send Path (Critical)

Currently VAD blocks the audio send loop. Every audio chunk must pass through VAD inference before it can be sent to the server. If VAD takes 20ms, that's 20ms of latency added to every single chunk.

**Fix:** Move VAD to a parallel worker. Audio sends continue immediately. VAD only gates **when to commit** the audio buffer, not whether to send audio at all.

**Strategy:** In passthrough mode (current web path, no VAD), audio goes straight to the WebSocket. In desktop mode with VAD:
1. Audio chunks are sent to the WebSocket immediately (no VAD gating on send)
2. VAD runs in parallel on a Web Worker
3. When VAD detects speech end, it sends `input_audio_buffer.commit` + `clear`
4. When VAD detects speech start, noop (we're already sending)
5. When VAD detects silence, we still send audio — the server is better at ignoring silence than we are at gating it client-side

This means we always send audio, but we use VAD signals to tell the server "this utterance is done, finalize it." The result: zero VAD latency on the audio path, and the server still gets properly segmented utterances.

**Implementation:**
- Move VAD inference to a Web Worker (`src/workers/vad-worker.ts`)
- VAD worker receives audio frames via `postMessage`, returns `VADResult` events
- Main thread audio handler sends every chunk to WebSocket immediately
- Main thread listens for VAD events (speechStart, speechEnd) and sends commit/clear accordingly
- Pre-buffer logic: instead of buffering audio and sending pre-buffer on speech start, we've already been sending it. Just send the commit/clear signals.

**Estimated savings:** 15-40ms per chunk (VAD no longer blocks send path)

#### 2.2 Batch VAD Frame Processing

Currently `processInt16` processes all 512-sample frames in a chunk sequentially. Each frame requires an ONNX inference call. For a 4096-sample processor buffer at 16kHz, that's 8 frames × ~5ms inference = 40ms.

**Fix:** Batch processing — accumulate frames and run them in a single ONNX session batch. Silero doesn't natively support batching, but we can overlap frame processing with audio collection by processing VAD asynchronously.

With the worker approach (2.1), VAD processing time becomes irrelevant to the audio send latency. Frames are processed as fast as the worker can run, and the commit/clear signals arrive whenever they're ready.

**Estimated savings:** Included in 2.1 — VAD latency is no longer on the critical path

### Phase 3: React Rendering Optimization (est. ~10-30ms saved)

#### 3.1 Batch Transcript Updates

Every `setTranscriptMessages(prev => [...prev, newMsg])` creates a new array and triggers a re-render. For streaming updates (delta messages), this happens for every small text change, sometimes multiple times per second.

**Fix:** Use a ref-based approach for streaming text and batch React updates:
- Streaming deltas update a ref, not state
- A `requestAnimationFrame` or `setInterval(16ms)` reconciles the ref to state at most once per frame
- Final messages update state immediately

```typescript
// Instead of immediate state update for every delta:
// setTranscriptMessages(prev => prev.map(msg => msg.id === id ? {...msg, text} : msg));

// Use:
streamingTextRef.current = text; // Fast, no render
scheduleReconcile(); // Batches to next animation frame
```

#### 3.2 Memoize Transcript and Translation Panel Components

`TranscriptPanel` and `TranslationPanel` re-render on every message update even when their props haven't changed. Wrap with `React.memo` and use stable callback references.

**Estimated savings:** 10-30ms per update cycle (reduced main-thread work)

### Phase 4: WebSocket & Protocol Optimization (est. ~50-150ms saved)

#### 4.1 Reduce Auto-Reset Interval

Current: `autoResetInterval: 5 * 60 * 1000` (5 minutes). This disconnects and reconnects the WebSocket every 5 minutes to "release GPU memory." The reconnect adds 200-500ms latency when it happens mid-utterance.

**Fix:** Increase to 10-15 minutes, or better yet, only auto-reset during detected silence (use VAD signals). If VAD says no speech for N seconds, then trigger the reset.

#### 4.2 Pre-warm WebSocket Connection

When the user clicks "Start Recording," the current flow is:
1. Click → 2. Create WebSocket → 3. Wait for open → 4. Send session.update → 5. Start audio

Steps 2-4 take 100-300ms. We can pre-warm the connection on page load or when the user hovers over the record button.

**Implementation:**
- Add a `warmConnection()` function that creates the WebSocket and sends `session.update`
- Call it on component mount or on hover/focus of the record button
- On actual recording start, check if the pre-warmed connection is still open; if yes, skip connection setup; if no, create a fresh one

**Estimated savings:** 100-300ms on first recording start

#### 4.3 Binary WebSocket for Audio (Future)

The current protocol sends JSON with base64-encoded audio:
```json
{ "type": "input_audio_buffer.append", "audio": "<base64 string>" }
```

Base64 encoding adds ~33% overhead. A 4096-byte PCM chunk becomes ~5460 bytes of JSON. For Speaches (which uses the OpenAI Realtime API protocol), we're stuck with this format. But if/when we support a custom server, we could use binary WebSocket frames directly.

**Not actionable now** since we depend on the Speaches/OpenAI protocol, but worth noting for future.

### Phase 5: Server-Side & Deployment Optimization (Not in scope, but documented)

These are out of scope for client-side changes but contribute to perceived latency:

| Optimization | Impact | Notes |
|-------------|--------|-------|
| GPU acceleration for Whisper | -200-500ms | Speaches already uses GPU; ensure it's configured |
| Model choice (tiny/base/small vs large) | -100-400ms | faster-whisper-large-v3 is accurate but slow; consider medium for real-time |
| Server proximity | -50-200ms | Deploy Speaches close to users |
| Connection pooling | -50-100ms | Keep WebSocket warm between sessions |

## Implementation Order

Priority is highest-impact, lowest-risk changes first:

| Step | Change | Est. Latency Saved | Risk | Effort |
|------|--------|--------------------|------ |--------|
| **1** | Phase 1.3: Request 16kHz AudioContext directly | 10-30ms | Low — one config change | Tiny |
| **2** | Phase 1.2: Optimize `int16ToBase64` | 5-15ms | Low — pure function swap | Tiny |
| **3** | Phase 3.2: Memoize transcript/translation panels | 10-30ms | Low — `React.memo` | Small |
| **4** | Phase 4.2: Pre-warm WebSocket on hover | 100-300ms | Medium — connection lifecycle | Medium |
| **5** | Phase 3.1: Batch streaming updates via rAF | 10-30ms | Medium — streaming state refactor | Medium |
| **6** | Phase 1.1: AudioWorklet migration | 20-60ms | Higher — new worklet file, Safari concerns | Medium |
| **7** | Phase 2.1: Move VAD to Web Worker, parallel send | 15-40ms | Higher — threading architecture change | Large |
| **8** | Phase 4.1: Smart auto-reset (silence-gated) | 50-150ms | Medium — timing logic | Small |

**Total estimated savings: ~220-655ms**, bringing total latency from ~550-2470ms down to ~330-1815ms, with the most common case around **400-800ms** — competitive with Zoom's <300ms for users with a local Speaches server.

## Testing Strategy

After each phase:
1. **Unit tests** for changed utilities (base64, resampling)
2. **Manual latency measurement**: Record audio with known timestamps, measure delay to text appearing
3. **Long-session stress test**: 30+ minute recording to verify no memory leaks from new patterns
4. **Browser compatibility**: Chrome, Firefox, Safari (AudioWorklet support varies)
5. **Desktop (Tauri) regression**: Verify VAD still works correctly with parallel architecture

## Key Metrics to Track

- **Time-to-first-token**: Milliseconds from speech start to first character appearing
- **Time-to-finalize**: Milliseconds from speech end to finalized transcript segment
- **Audio-to-text ratio**: During continuous speech, does text appear in near-real-time or in bursts?
- **Memory usage**: Over 30-minute session, does memory grow unbounded?
- **VAD accuracy**: After moving to parallel architecture, are commit/clear signals still correct?