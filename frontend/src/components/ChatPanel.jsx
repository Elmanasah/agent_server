import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send } from "lucide-react";

export function ChatPanel({ messages, onSend, disabled }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div className="panel-title">
          <MessageSquare size={14} />
          <span>TRANSCRIPT</span>
        </div>
        <span className="badge">{messages.length} msg</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span>Conversation will appear here once connected…</span>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-msg chat-msg--${msg.role}`}
          >
            <span className="chat-msg-role">
              {msg.role === "user" ? "YOU" : "GEMINI"}
            </span>
            <p className="chat-msg-text">{msg.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          className="field-input chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message… (Enter to send)"
          disabled={disabled}
        />
        <button
          className="icon-btn icon-btn--send"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </section>
  );
}
