import { Wifi, WifiOff, Loader, Volume2 } from "lucide-react";

const STATUS_CONFIG = {
  disconnected: {
    icon: WifiOff,
    label: "OFFLINE",
    color: "var(--c-muted)",
    pulse: false,
  },
  connecting: {
    icon: Loader,
    label: "CONNECTING",
    color: "var(--c-amber)",
    pulse: true,
    spin: true,
  },
  connected: {
    icon: Wifi,
    label: "LIVE",
    color: "var(--c-cyan)",
    pulse: true,
  },
  speaking: {
    icon: Volume2,
    label: "RESPONDING",
    color: "var(--c-green)",
    pulse: true,
  },
};

export function StatusBar({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  const Icon = cfg.icon;

  return (
    <div className="status-bar">
      <div className={`status-indicator ${cfg.pulse ? "status-pulse" : ""}`}>
        <span className="status-dot" style={{ background: cfg.color }} />
        <Icon
          size={13}
          className={cfg.spin ? "spin" : ""}
          style={{ color: cfg.color }}
        />
        <span className="status-label" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </div>

      <div className="status-meta">
        <span>GEMINI LIVE</span>
        <span className="sep">·</span>
        <span>VERTEX AI</span>
      </div>
    </div>
  );
}
