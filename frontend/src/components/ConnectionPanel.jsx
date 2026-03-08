import { useState } from "react";
import { KeyRound, Plug, PlugZap, ChevronDown, ChevronUp } from "lucide-react";

export function ConnectionPanel({ status, onConnect, onDisconnect }) {
  const [token, setToken] = useState(() => localStorage.getItem("gl_token") || "");
  const [projectId, setProjectId] = useState(() => localStorage.getItem("gl_project") || "");
  const [location, setLocation] = useState(() => localStorage.getItem("gl_location") || "us-central1");
  const [systemInstructions, setSystemInstructions] = useState(
    () =>
      localStorage.getItem("gl_system") ||
      "You are a real-time vision assistant. You receive live video frames and audio, and respond with voice and text simultaneously."
  );
  const [expanded, setExpanded] = useState(true);

  const isConnected = status === "connected" || status === "speaking";
  const isConnecting = status === "connecting";

  function save(key, val) {
    localStorage.setItem(key, val);
  }

  function handleConnect() {
    if (!token || !projectId) return;
    save("gl_token", token);
    save("gl_project", projectId);
    save("gl_location", location);
    save("gl_system", systemInstructions);
    onConnect({ accessToken: token, projectId, location, systemInstructions });
    setExpanded(false);
  }

  return (
    <section className="panel connection-panel">
      <div className="panel-header" onClick={() => setExpanded((v) => !v)}>
        <div className="panel-title">
          <KeyRound size={14} />
          <span>CONNECTION</span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {expanded && (
        <div className="panel-body">
          <div className="field-group">
            <label className="field-label">Access Token</label>
            <input
              type="password"
              className="field-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token from gcloud auth…"
              disabled={isConnected || isConnecting}
            />
          </div>

          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Project ID</label>
              <input
                className="field-input"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="my-gcp-project"
                disabled={isConnected || isConnecting}
              />
            </div>
            <div className="field-group field-group--sm">
              <label className="field-label">Location</label>
              <input
                className="field-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isConnected || isConnecting}
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">System Instructions</label>
            <textarea
              className="field-input field-textarea"
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
              rows={3}
              disabled={isConnected || isConnecting}
            />
          </div>

          <div className="btn-row">
            {!isConnected ? (
              <button
                className="btn btn--primary"
                onClick={handleConnect}
                disabled={isConnecting || !token || !projectId}
              >
                <Plug size={14} />
                {isConnecting ? "Connecting…" : "Connect"}
              </button>
            ) : (
              <button className="btn btn--danger" onClick={onDisconnect}>
                <PlugZap size={14} />
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
