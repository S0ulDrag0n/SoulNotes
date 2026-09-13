/**
 * Type declarations for the Audio Worklet global scope.
 *
 * These types are available inside AudioWorklet processors but are not
 * included in the default TypeScript DOM library. This declaration file
 * makes the TypeScript source of our worklets type-safe.
 */
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;