// ─── Video Manager (Webcam) ───────────────────────────────────────────────────

export class VideoManager {
  /**
   * @param {HTMLVideoElement} videoEl
   * @param {HTMLCanvasElement} canvasEl
   */
  constructor(videoEl, canvasEl) {
    this.videoEl = videoEl;
    this.canvasEl = canvasEl;
    this.ctx = canvasEl.getContext("2d");
    this._stream = null;
    this._interval = null;

    /** @type {(base64JPEG: string) => void} */
    this.onFrame = () => {};
  }

  async start(deviceId) {
    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
      };
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoEl.srcObject = this._stream;
    } catch (err) {
      console.error("[VideoManager] getUserMedia error:", err);
      throw err;
    }
    this._interval = setInterval(() => this._captureFrame(), 1000);
  }

  async updateDevice(deviceId) {
    this.stop();
    await this.start(deviceId);
  }

  stop() {
    clearInterval(this._interval);
    this._interval = null;
    this._stream?.getTracks().forEach((t) => t.stop());
    this._stream = null;
  }

  _captureFrame() {
    if (!this._stream) return;
    const { videoWidth: w, videoHeight: h } = this.videoEl;
    if (!w || !h) return;

    this.canvasEl.width = w;
    this.canvasEl.height = h;
    this.ctx.drawImage(this.videoEl, 0, 0, w, h);
    const b64 = this.canvasEl.toDataURL("image/jpeg", 0.8).split(",")[1];
    if (b64) this.onFrame(b64);
  }
}

// ─── Screen Manager ───────────────────────────────────────────────────────────

export class ScreenManager {
  /**
   * @param {HTMLVideoElement} videoEl
   * @param {HTMLCanvasElement} canvasEl
   */
  constructor(videoEl, canvasEl) {
    this.videoEl = videoEl;
    this.canvasEl = canvasEl;
    this.ctx = canvasEl.getContext("2d");
    this._stream = null;
    this._interval = null;

    /** @type {(base64JPEG: string) => void} */
    this.onFrame = () => {};
  }

  async start() {
    try {
      this._stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      this.videoEl.srcObject = this._stream;
    } catch (err) {
      console.error("[ScreenManager] getDisplayMedia error:", err);
      throw err;
    }
    this._interval = setInterval(() => this._captureFrame(), 1000);
  }

  stop() {
    clearInterval(this._interval);
    this._interval = null;
    this._stream?.getTracks().forEach((t) => t.stop());
    this._stream = null;
  }

  _captureFrame() {
    if (!this._stream) return;
    const TARGET = 768;
    this.canvasEl.width = TARGET;
    this.canvasEl.height = TARGET;
    this.ctx.clearRect(0, 0, TARGET, TARGET);
    this.ctx.drawImage(this.videoEl, 0, 0, TARGET, TARGET);
    const b64 = this.canvasEl.toDataURL("image/jpeg", 0.7).split(",")[1];
    if (b64) this.onFrame(b64);
  }
}
