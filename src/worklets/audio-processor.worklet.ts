/**
 * AudioWorkletProcessor for low-latency audio capture.
 *
 * Runs on a dedicated audio thread (not the main thread), avoiding
 * glitches caused by React renders, garbage collection, or other
 * main-thread work that could block ScriptProcessorNode.
 *
 * The processor captures Float32 audio from input channel 0, converts
 * it to Int16 PCM (matching the floatTo16BitPCM logic in @/utils/audio),
 * and posts the data to the main thread using transferable objects
 * (ArrayBuffer transfer) to avoid copying overhead.
 *
 * Usage from the main thread:
 *   const node = new AudioWorkletNode(audioContext, 'audio-processor');
 *   node.port.onmessage = (e) => {
 *     const pcm16 = e.data.pcm16; // Int16Array
 *     // base64-encode and send via WebSocket
 *   };
 *
 * Note: This is the TypeScript source. For production use in Next.js,
 * the pre-compiled plain JS version at public/worklets/audio-processor.worklet.js
 * is what gets loaded by the browser (worklets cannot load TS modules).
 */
class AudioProcessorWorklet extends AudioWorkletProcessor {
  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true; // keep processor alive
    }

    const channelData = input[0];
    if (!channelData || channelData.length === 0) {
      return true;
    }

    // Convert Float32 → Int16 (same logic as floatTo16BitPCM)
    const pcm16 = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Transfer the underlying ArrayBuffer to avoid copying
    this.port.postMessage(
      { type: 'audio-data', pcm16 },
      [pcm16.buffer],
    );

    return true; // keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessorWorklet);