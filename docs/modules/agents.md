# Agents Module (`src/modules/agents`)

The Agents module sits exclusively on the WebSocket layer, facilitating the complex bidirectional streaming architectures required to orchestrate Gemini 2.0 Live and proxy the interactive Workspace tool-calling ecosystem.

## Realtime Architecture

Unlike standard REST controllers, the Live Agent functions symmetrically. There is no traditional "request-response" lifecycle.

### The `LiveAgentSession` Wrapper (`liveAgent.service.js`)
When a user connects their browser via WebSocket for a live Audio/Canvas session:
1. **Authentication Intercept**: The very first message arriving from the browser must contain a standard JWT token. The session extracts and verifies this, discarding connections that fail.
2. **Traffic Director**: Once authorized, the Service pipes the browser's incoming blob data (Audio/Video chunks) directly upward to the Google Cloud AI WebSocket stream.
3. **Function Interception**: As Gemini streams content down, the Service parses the chunks for explicit `BidiGenerateContentToolCall` identifiers. 

## Internal Tool Ecosystem
Gemini is instructed (via System Prompting) to use specialized tools rather than attempting to print mathematical JSON over audio.
When `liveAgent.service.js` encounters a tool request from Gemini, it halts the proxy and evaluates the tool locally on the backend:

- **`search_knowledge_base`**: Yields out to the `rag.service.js` to run vector similarity searches against the user's uploaded documents. Data is returned silently back to Gemini to influence conversational responses.
- **`search_sessions`**: Yields to `sessionSearch.service.js` to analyze the Postgres DB history for previous interactions to maintain perfect memory.
- **`generate_image`**: Hits `Imagen3` and secures the URL. It replies "Done" to Gemini.
- **`render_canvas` / `render_diagram` / `render_math`**: Pushes rich tool payloads downwards. 

**Dual Output Multiplexing**: 
If a tool execution outputs visual elements (like an image URL or Markdown syntax), the Session explicitly mirrors the payload down to the Browser WebSocket client in a proprietary `tool_result` event, so that the React `Canvas Workspace` reacts instantaneously alongside Gemini's audio voice declaring it complete.

## Module Flowchart

```eraser
title Agents Module Diagram (WebSocket)

React Client [icon: react, color: blue]
Gemini Live [label: "Gemini 2.0 Live", icon: cloud, color: green]

WS Proxy [icon: terminal, color: purple] {
  LiveAgentSession [icon: cpu]
}

Local Tools [icon: box, color: orange] {
  RAG Search [icon: search]
  Session Search [icon: message-square]
  Imagen 3 [icon: image]
}

// Connections
React Client <> LiveAgentSession: Audio/Video & Secure JWT
LiveAgentSession <> Gemini Live: Proxy Server Bidi Streams
Gemini Live > LiveAgentSession: BidiGenerateContentToolCall
LiveAgentSession <> Local Tools: Execute Requested Tool locally
LiveAgentSession > React Client: Forward visual Tool Result payload for UI
```
