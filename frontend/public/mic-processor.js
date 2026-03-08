/**
 * Mic Processor – AudioWorklet that converts Float32 mic samples to Int16
 * and posts them back to the main thread in small chunks.
 */
class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const float32 = input[0];
      const int16 = new Int16Array(float32.length);

      for (let i = 0; i < float32.length; i++) {
        const clamped = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
      }

      // Transfer ownership for zero-copy
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
