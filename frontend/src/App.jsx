import { useState, useCallback } from "react";
import { useGemini } from "./hooks/useGemini";
import { StatusBar } from "./components/StatusBar";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ControlBar } from "./components/ControlBar";
import { VideoPreview } from "./components/VideoPreview";
import { ChatPanel } from "./components/ChatPanel";
import { ErrorBanner } from "./components/ErrorBanner";

export default function App() {
  const {
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
    clearError,
  } = useGemini();

  const [videoEl, setVideoEl] = useState(null);
  const [canvasEl, setCanvasEl] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [screenActive, setScreenActive] = useState(false);

  const handleStartCamera = useCallback(() => {
    if (!videoEl || !canvasEl) return;
    setScreenActive(false);
    startCamera(videoEl, canvasEl);
    setCameraActive(true);
  }, [videoEl, canvasEl, startCamera]);

  const handleStopCamera = useCallback(() => {
    stopCamera();
    setCameraActive(false);
  }, [stopCamera]);

  const handleStartScreen = useCallback(() => {
    if (!videoEl || !canvasEl) return;
    setCameraActive(false);
    startScreen(videoEl, canvasEl);
    setScreenActive(true);
  }, [videoEl, canvasEl, startScreen]);

  const handleStopScreen = useCallback(() => {
    stopScreen();
    setScreenActive(false);
  }, [stopScreen]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setCameraActive(false);
    setScreenActive(false);
  }, [disconnect]);

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-logo">
            <span className="brand-logo-dot" />
            <span className="brand-logo-dot" />
            <span className="brand-logo-dot" />
          </div>
          <span className="brand-name">GEMINI LIVE</span>
        </div>
        <StatusBar status={status} />
      </header>

      <ErrorBanner error={error} onDismiss={clearError} />

      {/* Main grid */}
      <main className="main-grid">
        {/* Left column */}
        <div className="col-left">
          <ConnectionPanel
            status={status}
            onConnect={connect}
            onDisconnect={handleDisconnect}
          />

          <ControlBar
            status={status}
            micMuted={micMuted}
            onToggleMic={toggleMic}
            onStartCamera={handleStartCamera}
            onStopCamera={handleStopCamera}
            onStartScreen={handleStartScreen}
            onStopScreen={handleStopScreen}
            onUpdateCamera={updateCamera}
            onUpdateMic={updateMic}
            cameraActive={cameraActive}
            screenActive={screenActive}
          />

          <VideoPreview
            active={cameraActive || screenActive}
            onVideoRef={setVideoEl}
            onCanvasRef={setCanvasEl}
          />
        </div>

        {/* Right column */}
        <div className="col-right">
          <ChatPanel
            messages={messages}
            onSend={sendText}
            disabled={status === "disconnected" || status === "connecting"}
          />
        </div>
      </main>

      {/* Scanline overlay */}
      <div className="scanlines" aria-hidden="true" />
    </div>
  );
}
