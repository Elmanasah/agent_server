/**
 * PCM Processor – AudioWorklet for streaming PCM16LE audio to the speaker.
 * The main thread posts Float32Array chunks; this worklet drains them in order.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = [];
    this._offset = 0;

    this.port.onmessage = (e) => {
      // e.data is a Float32Array sent from the main thread
      this._queue.push(e.data);
    };
  }

  process(_inputs, outputs) {
    const channel = outputs[0][0];
    let written = 0;

    while (written < channel.length && this._queue.length > 0) {
      const chunk = this._queue[0];
      const remaining = chunk.length - this._offset;
      const needed = channel.length - written;

      if (remaining <= needed) {
        channel.set(chunk.subarray(this._offset), written);
        written += remaining;
        this._offset = 0;
        this._queue.shift();
      } else {
        channel.set(chunk.subarray(this._offset, this._offset + needed), written);
        this._offset += needed;
        written = channel.length;
      }
    }
  }

  // process(inputs, outputs) {
  //   const output = outputs[0];
  //   const channel = output[0];
  //
  //   // SAFETY VALVE: If the buffer is over 2 seconds (48,000 samples),
  //   // clear it to catch up. This prevents "infinity lag."
  //   if (this.buffer.length > 48000) {
  //     console.warn("Audio buffer overflow, skipping to catch up...");
  //     this.buffer = this.buffer.slice(-12000); // Keep only the last 500ms
  //   }
  //
  //   if (this.buffer.length < 2000) { // Small buffer for stability
  //     return true;
  //   }
  //
  //   for (let i = 0; i < channel.length; i++) {
  //     channel[i] = this.buffer.length > 0 ? this.buffer.shift() : 0;
  //   }
  //
  //   return true;
  // }
}

registerProcessor("pcm-processor", PCMProcessor);
