import { useEffect, useRef } from "react";
import { Video, VideoOff } from "lucide-react";

export function VideoPreview({ active, onVideoRef, onCanvasRef }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) onVideoRef(videoRef.current);
    if (canvasRef.current) onCanvasRef(canvasRef.current);
  }, []);

  return (
    <section className="panel video-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Video size={14} />
          <span>VIDEO PREVIEW</span>
        </div>
        <span className={`badge ${active ? "badge--live" : "badge--off"}`}>
          {active ? "LIVE" : "IDLE"}
        </span>
      </div>

      <div className="video-wrapper">
        {!active && (
          <div className="video-placeholder">
            <VideoOff size={32} />
            <span>No video source</span>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`video-el ${active ? "video-el--visible" : ""}`}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </section>
  );
}
