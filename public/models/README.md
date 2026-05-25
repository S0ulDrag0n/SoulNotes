# Models Directory

This directory contains model files used by the application.

## Files

### silero_vad.onnx
Silero VAD (Voice Activity Detection) model (~2.2MB). Used by the desktop (Tauri) audio
pipeline to detect speech in real-time and filter out silence/noise before sending audio
to the Whisper transcription server.

- Source: https://github.com/snakers4/silero-vad
- Input: 512 samples at 16kHz (32ms frames)
- Output: Speech probability (0.0-1.0)
- Stateful: carries hidden state [2, 1, 128] across frames

### ONNX Runtime WASM files
These files are required by `onnxruntime-web` for running inference in the browser/Tauri webview:

- `ort-wasm-simd-threaded.wasm` — main WASM binary (SIMD+threading)
- `ort-wasm-simd-threaded.jsep.wasm` — JavaScript Engine Sidecar Plugin
- `ort-wasm-simd-threaded.mjs` — WASM module loader
- `ort-wasm-simd-threaded.jsep.mjs` — JSEP module loader

These are copied from `node_modules/onnxruntime-web/dist/` during setup.
When upgrading `onnxruntime-web`, re-copy these files to this directory.