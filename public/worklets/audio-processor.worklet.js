/**
 * AudioWorkletProcessor for low-latency audio capture (pre-compiled plain JS).
 *
 * Runs on a dedicated audio thread (not the main thread), avoiding glitches
 * caused by React renders, garbage collection, or other main-thread work.
 *
 * Captures Float32 audio from input channel 0, converts to Int16 PCM, and
 * posts the data to the main thread using transferable objects.
 *
 * This file is loaded directly by the browser via audioContext.audioWorklet.addModule()
 * so it MUST be plain JavaScript — no TypeScript, no imports, no bundler.
 */
class AudioProcessorWorklet extends AudioWorkletProcessor {
  process(inputs, _outputs, _parameters) {
    var input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    var channelData = input[0];
    if (!channelData || channelData.length === 0) {
      return true;
    }

    // Convert Float32 → Int16 (same logic as floatTo16BitPCM)
    var pcm16 = new Int16Array(channelData.length);
    for (var i = 0; i < channelData.length; i++) {
      var s = Math.max(-1, Math.min(1, channelData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Transfer the underlying ArrayBuffer to avoid copying
    this.port.postMessage(
      { type: 'audio-data', pcm16: pcm16 },
      [pcm16.buffer],
    );

    return true; // keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessorWorklet);