import { AlertTriangle, X } from "lucide-react";

export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="error-banner">
      <AlertTriangle size={14} />
      <span>{error}</span>
      <button className="error-dismiss" onClick={onDismiss}>
        <X size={12} />
      </button>
    </div>
  );
}
