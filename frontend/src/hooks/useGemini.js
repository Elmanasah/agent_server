import { useRef, useState, useCallback } from "react";
import { GeminiLiveAPI } from "../services/GeminiLiveAPI";
import { AudioInputManager, AudioOutputManager } from "../services/AudioManager";
import { VideoManager, ScreenManager } from "../services/VideoManager";

const DEFAULT_SYSTEM = `You are a real-time vision assistant. You receive live video frames and audio, and respond with voice and text simultaneously. Prioritize visual information; if a frame is unclear, say so instead of guessing.`;

const MODEL = "gemini-live-2.5-flash-native-audio";
const API_HOST = "us-central1-aiplatform.googleapis.com";

/** @typedef {"disconnected"|"connecting"|"connected"|"speaking"} AppStatus */

export function useGemini() {
  const [status, setStatus] = useState(/** @type {AppStatus} */ ("disconnected"));
  const [messages, setMessages] = useState(/** @type {{role:string,text:string,id:number}[]} */ ([]));
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [micMuted, setMicMuted] = useState(false);

  const geminiRef = useRef(/** @type {GeminiLiveAPI|null} */ (null));
  const audioOutRef = useRef(new AudioOutputManager());
  const audioInRef = useRef(new AudioInputManager());
  const videoRef = useRef(/** @type {VideoManager|null} */ (null));
  const screenRef = useRef(/** @type {ScreenManager|null} */ (null));

  const addMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { role, text, id: Date.now() + Math.random() }]);
  }, []);

  // ─── Connect ─────────────────────────────────────────────────────────────

  const connect = useCallback(
    async ({ accessToken, projectId, location, systemInstructions }) => {
      setError(null);
      setStatus("connecting");

      const api = new GeminiLiveAPI({
        projectId,
        location: location || "us-central1",
        model: MODEL,
        apiHost: API_HOST,
      });

      api.systemInstructions = systemInstructions || DEFAULT_SYSTEM;
      api.responseModalities = ["AUDIO"]; // API only allows one; transcription comes via output_audio_transcription

      api.onConnectionStarted = async () => {
        setStatus("connected");
        // Start microphone
        try {
          audioInRef.current.onChunk = (b64) => api.sendAudio(b64);
          await audioInRef.current.connect();
        } catch (err) {
          setError("Microphone access denied: " + err.message);
        }
      };

      api.onReceiveResponse = ({ type, data }) => {
        if (type === "AUDIO") {
          setStatus("speaking");
          audioOutRef.current.playChunk(data).then(() => setStatus("connected"));
        }
        if (type === "TEXT") {
          addMessage("assistant", data);
        }
      };

      api.onDisconnected = () => {
        setStatus("disconnected");
        _stopAll();
      };

      api.onError = (msg) => {
        setError(msg);
        setStatus("disconnected");
        _stopAll();
      };

      geminiRef.current = api;
      api.connect(accessToken);
    },
    [addMessage]
  );

  // ─── Disconnect ──────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    geminiRef.current?.disconnect();
    _stopAll();
    setStatus("disconnected");
  }, []);

  function _stopAll() {
    audioInRef.current.disconnect();
    videoRef.current?.stop();
    screenRef.current?.stop();
  }

  // ─── Mic toggle ──────────────────────────────────────────────────────────

  const toggleMic = useCallback(async () => {
    if (micMuted) {
      try {
        await audioInRef.current.connect();
        audioInRef.current.onChunk = (b64) => geminiRef.current?.sendAudio(b64);
        setMicMuted(false);
      } catch (err) {
        setError("Mic error: " + err.message);
      }
    } else {
      audioInRef.current.disconnect();
      setMicMuted(true);
    }
  }, [micMuted]);

  // ─── Camera ──────────────────────────────────────────────────────────────

  const startCamera = useCallback((videoEl, canvasEl, deviceId) => {
    screenRef.current?.stop();
    if (!videoRef.current) {
      videoRef.current = new VideoManager(videoEl, canvasEl);
    }
    videoRef.current.onFrame = (b64) => geminiRef.current?.sendImage(b64);
    videoRef.current.start(deviceId);
  }, []);

  const stopCamera = useCallback(() => {
    videoRef.current?.stop();
  }, []);

  const updateCamera = useCallback((deviceId) => {
    videoRef.current?.updateDevice(deviceId);
  }, []);

  // ─── Screen share ────────────────────────────────────────────────────────

  const startScreen = useCallback((videoEl, canvasEl) => {
    videoRef.current?.stop();
    if (!screenRef.current) {
      screenRef.current = new ScreenManager(videoEl, canvasEl);
    }
    screenRef.current.onFrame = (b64) => geminiRef.current?.sendImage(b64);
    screenRef.current.start().catch((err) => setError("Screen share failed: " + err.message));
  }, []);

  const stopScreen = useCallback(() => {
    screenRef.current?.stop();
  }, []);

  // ─── Text message ────────────────────────────────────────────────────────

  const sendText = useCallback(
    (text) => {
      if (!text.trim()) return;
      addMessage("user", text);
      geminiRef.current?.sendText(text);
    },
    [addMessage]
  );

  // ─── Mic device update ───────────────────────────────────────────────────

  const updateMic = useCallback(async (deviceId) => {
    await audioInRef.current.updateDevice(deviceId);
    audioInRef.current.onChunk = (b64) => geminiRef.current?.sendAudio(b64);
  }, []);

  return {
    status,
    messages,
    error,
    micMuted,
    connect,
    disconnect,
    toggleMic,
    sendText,
    startCamera,
    stopCamera,
    updateCamera,
    startScreen,
    stopScreen,
    updateMic,
    clearError: () => setError(null),
  };
}
