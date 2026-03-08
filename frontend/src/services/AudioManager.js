// ─── Audio Output ─────────────────────────────────────────────────────────────

export class AudioOutputManager {
  constructor() {
    this._ctx = null;
    this._worklet = null;
    this._ready = false;
  }

  async _init() {
    if (this._ready) return;
    this._ctx = new AudioContext({ sampleRate: 24000 });
    await this._ctx.audioWorklet.addModule("/pcm-processor.js");
    this._worklet = new AudioWorkletNode(this._ctx, "pcm-processor");
    this._worklet.connect(this._ctx.destination);
    this._ready = true;
  }


  async playChunk(base64PCM) {
    try {
      await this._init();

      if (this._ctx.state === "suspended") await this._ctx.resume();

      const binary = atob(base64PCM);
      const int16 = new Int16Array(binary.length / 2);
      for (let i = 0; i < int16.length; i++) {
        int16[i] = (binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8));
      }

      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      this._worklet.port.postMessage(float32);
    } catch (err) {
      console.error("[AudioOutputManager]", err);
    }
  }

  // async playChunk(base64PCM) {
  //   try {
  //     if (!this._initialized) await this._init();
  //     if (this._ctx.state === "suspended") await this._ctx.resume();
  //
  //     // 1. FAST BASE64 TO BYTES
  //     const binaryString = atob(base64PCM);
  //     const len = binaryString.length;
  //     const bytes = new Uint8Array(len);
  //     for (let i = 0; i < len; i++) {
  //       bytes[i] = binaryString.charCodeAt(i);
  //     }
  //
  //     // 2. INSTANT CONVERSION
  //     // Create an Int16 view of the SAME memory buffer (no loop needed here!)
  //     const int16 = new Int16Array(bytes.buffer);
  //     const float32 = new Float32Array(int16.length);
  //
  //     // 3. FASTER FLOAT CONVERSION
  //     for (let i = 0; i < int16.length; i++) {
  //       float32[i] = int16[i] / 32768.0;
  //     }
  //
  //     this._worklet.port.postMessage(float32);
  //   } catch (err) {
  //     console.error("[AudioOutputManager] Processing lag:", err);
  //   }
  // }

  destroy() {
    this._ctx?.close();
    this._ready = false;
  }
}

// ─── Audio Input ──────────────────────────────────────────────────────────────

export class AudioInputManager {
  constructor() {
    this._ctx = null;
    this._worklet = null;
    this._stream = null;
    this._buffer = [];

    /** @type {(base64: string) => void} */
    this.onChunk = () => {};
  }

  async connect(deviceId) {
    this._ctx = new AudioContext({ sampleRate: 16000 });
    await this._ctx.audioWorklet.addModule("/mic-processor.js");

    const constraints = {
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    };

    this._stream = await navigator.mediaDevices.getUserMedia(constraints);
    const source = this._ctx.createMediaStreamSource(this._stream);

    this._worklet = new AudioWorkletNode(this._ctx, "mic-processor");
    source.connect(this._worklet);

    this._worklet.port.onmessage = (e) => {
      const int16 = new Int16Array(e.data);
      this._buffer.push(...int16);

      // ~200 ms at 16 kHz = 3200 samples
      if (this._buffer.length >= 3200) {
        const pcm = new Int16Array(this._buffer.splice(0, 3200));
        this.onChunk(this._arrayBufferToBase64(pcm.buffer));
      }
    };
  }

  async updateDevice(deviceId) {
    this.disconnect();
    await this.connect(deviceId);
  }

  disconnect() {
    this._stream?.getTracks().forEach((t) => t.stop());
    this._ctx?.close();
    this._buffer = [];
    this._ctx = null;
    this._worklet = null;
    this._stream = null;
  }

  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
}
