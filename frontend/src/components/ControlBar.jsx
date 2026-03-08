import { Mic, MicOff, Camera, Monitor, CameraOff, MonitorOff } from "lucide-react";
import { useDevices } from "../hooks/useDevices";

export function ControlBar({
  status,
  micMuted,
  onToggleMic,
  onStartCamera,
  onStopCamera,
  onStartScreen,
  onStopScreen,
  onUpdateCamera,
  onUpdateMic,
  cameraActive,
  screenActive,
}) {
  const { cameras, microphones } = useDevices();
  const isActive = status === "connected" || status === "speaking";

  return (
    <section className="panel control-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Mic size={14} />
          <span>INPUT CONTROLS</span>
        </div>
      </div>

      <div className="panel-body">
        {/* Device selectors */}
        <div className="field-row">
          <div className="field-group">
            <label className="field-label">Microphone</label>
            <select
              className="field-input field-select"
              onChange={(e) => onUpdateMic(e.target.value)}
              disabled={!isActive}
            >
              {microphones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label">Camera</label>
            <select
              className="field-input field-select"
              onChange={(e) => onUpdateCamera(e.target.value)}
              disabled={!isActive}
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Icon buttons */}
        <div className="icon-btn-row">
          {/* Mic toggle */}
          <button
            className={`icon-btn ${micMuted ? "icon-btn--off" : "icon-btn--on"}`}
            onClick={onToggleMic}
            disabled={!isActive}
            title={micMuted ? "Unmute mic" : "Mute mic"}
          >
            {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
            <span>{micMuted ? "Unmute" : "Mute"}</span>
          </button>

          {/* Camera toggle */}
          <button
            className={`icon-btn ${cameraActive ? "icon-btn--active" : ""}`}
            onClick={cameraActive ? onStopCamera : onStartCamera}
            disabled={!isActive}
            title={cameraActive ? "Stop camera" : "Start camera"}
          >
            {cameraActive ? <CameraOff size={18} /> : <Camera size={18} />}
            <span>{cameraActive ? "Stop Cam" : "Camera"}</span>
          </button>

          {/* Screen share toggle */}
          <button
            className={`icon-btn ${screenActive ? "icon-btn--active" : ""}`}
            onClick={screenActive ? onStopScreen : onStartScreen}
            disabled={!isActive}
            title={screenActive ? "Stop screen share" : "Share screen"}
          >
            {screenActive ? <MonitorOff size={18} /> : <Monitor size={18} />}
            <span>{screenActive ? "Stop Share" : "Screen"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
