/**
 * GeminiLiveAPI
 *
 * Flow:
 *  1. Client connects to proxy WebSocket
 *  2. Client sends { bearer_token, service_url }
 *  3. Proxy connects to GCP, then sends { proxy_ready: true }
 *  4. Client sends setup, GCP replies { setupComplete: true }
 *  5. onConnectionStarted() is called — mic/video can now begin
 */

const PROXY_URL = "ws://localhost:8080";

export class GeminiLiveAPI {
  constructor({ projectId, location, model, apiHost }) {
    this.projectId = projectId;
    this.location = location;
    this.model = model ?? "gemini-live-2.5-flash-native-audio";
    this.apiHost = apiHost ?? "us-central1-aiplatform.googleapis.com";

    this.modelUri = `projects/${projectId}/locations/${location}/publishers/google/models/${this.model}`;
    this.serviceUrl = `wss://${this.apiHost}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

    this.ws = null;
    this.responseModalities = ["AUDIO"];
    this.systemInstructions = "";

    this.onReceiveResponse = () => {};
    this.onConnectionStarted = () => {};
    this.onError = (msg) => console.error("[GeminiLiveAPI]", msg);
    this.onDisconnected = () => {};
  }

  connect(accessToken) {
    console.log("[GeminiLiveAPI] Connecting to proxy…");
    this.ws = new WebSocket(PROXY_URL);

    this.ws.onopen = () => {
      console.log("[GeminiLiveAPI] Socket open → sending auth only");
      this._send({ bearer_token: accessToken, service_url: this.serviceUrl });
      // Do NOT send setup yet — wait for proxy_ready signal
    };

    this.ws.onmessage = (evt) => this._handleMessage(evt);

    this.ws.onclose = (evt) => {
      console.log("[GeminiLiveAPI] Closed", evt.code, evt.reason);
      this.onDisconnected();
      if (evt.code !== 1000) {
        this.onError(`Connection closed (${evt.code}): ${evt.reason || "unknown"}`);
      }
    };

    this.ws.onerror = () => {
      this.onError("WebSocket error — is the proxy server running on port 8080?");
    };
  }

  disconnect() {
    this.ws?.close(1000, "User disconnect");
    this.ws = null;
  }

  _send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  _sendSetup() {
    console.log("[GeminiLiveAPI] Sending setup with modelUri:", this.modelUri);
    this._send({
      setup: {
        model: this.modelUri,
        generation_config: {
          response_modalities: ["AUDIO"],  // API only allows ONE modality
        },
        output_audio_transcription: {},
        system_instruction: { parts: [{ text: this.systemInstructions }] },
      },
    });
  }

  _handleMessage(evt) {
    try {
      const data = JSON.parse(evt.data);

      // Proxy confirmed GCP is open → now safe to send setup
      if (data.proxy_ready) {
        console.log("[GeminiLiveAPI] proxy_ready received → sending setup");
        this._sendSetup();
        return;
      }

      // GCP confirmed setup → session is live
      if (data.setupComplete) {
        console.log("[GeminiLiveAPI] setupComplete → calling onConnectionStarted");
        this.onConnectionStarted();
        return;
      }

      // Normal model responses
      const parts = data?.serverContent?.modelTurn?.parts ?? [];
      for (const part of parts) {
        if (part.text) this.onReceiveResponse({ type: "TEXT", data: part.text });
        if (part.inlineData?.data) this.onReceiveResponse({ type: "AUDIO", data: part.inlineData.data });
      }

      // output_audio_transcription arrives here (model transcript of its own speech)
      const transcript = data?.serverContent?.outputTranscription?.text;
      if (transcript) this.onReceiveResponse({ type: "TEXT", data: transcript });
    } catch (err) {
      console.error("[GeminiLiveAPI] Parse error:", err);
    }
  }

  sendText(text) {
    this._send({
      client_content: {
        turns: [{ role: "user", parts: [{ text }] }],
        turn_complete: true,
      },
    });
  }

  sendAudio(base64PCM) {
    if (!this.ws || this.ws.bufferedAmount > 200_000) return;
    this._send({ realtime_input: { media_chunks: [{ mime_type: "audio/pcm", data: base64PCM }] } });
  }

  sendImage(base64JPEG) {
    this._send({ realtime_input: { media_chunks: [{ mime_type: "image/jpeg", data: base64JPEG }] } });
  }
}
