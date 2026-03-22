# Horus Architecture

The Horus application is a production-grade multi-modal AI platform utilizing CockroachDB (via Sequelize), Google Vertex AI (Gemini 2.0 Live API, Vector Search, Imagen 3), and an interactive React frontend equipped with a synchronized Canvas Workspace.

## Component Overview

The core system architecture comprises three tightly-coupled domains:
1. **Frontend**: React-based UI handling complex bidi WebSocket streaming, multimedia capture, and rendering generated artifacts into the interactive Canvas workspace.
2. **Backend**: Express + Sequelize Node.js server handling REST operations, orchestrating the RAG pipeline, and securely proxying real-time function calls between the browser and Vertex AI.
3. **AI Infrastructure**: Fully decoupled Google Cloud resources responsible for embedding vectorization, real-time Audio/Video chat, image generation, and blob persistence.

## Flow Diagram

The following architecture diagram explicitly defines the infrastructure layout and data paths across the system.

> [!TIP]
> This diagram was built for [Eraser.io](https://app.eraser.io/). You can view the live interactive diagram here:
> **[View Architecture Diagram on Eraser.io](https://app.eraser.io/workspace/OvRV3VZmsSyw9M2B8ztX?origin=share&diagram=Tt4fop1drFxQNpt_FT8no)**

```eraser
title Architecture diagram

Frontend [icon: browser, color: blue] {
  React UI [icon: react]
  GeminiLiveAPI [icon: cable]
  Canvas Workspace [icon: monitor]
  Audio Video [icon: camera, label: "Audio/Video"]
}

Backend [icon: server, color: purple] {
  WS Proxy [icon: terminal]
  LiveAgentSession [icon: cpu]
  REST API [icon: globe]
  Sequelize ORM [icon: database]
}

AI Infrastructure [icon: cloud, color: green] {
  Gemini 2.0 Flash [icon: star]
  Vector Search [icon: search]
  Imagen 3 [icon: image]
  GCS Database [icon: database, label: "GCS / Database"]
}

// Connections
React UI <> REST API
GeminiLiveAPI <> WS Proxy: Real-time WS Stream
WS Proxy <> Gemini 2.0 Flash: Multimodal Live API
WS Proxy <> LiveAgentSession
LiveAgentSession > Vector Search: RAG Context
LiveAgentSession > Imagen 3: Image Gen
LiveAgentSession > GCS Database: Persistence
REST API > Sequelize ORM
Sequelize ORM > GCS Database

// Flow Arrows
LiveAgentSession < React UI: Tool Results
React UI > Canvas Workspace: Render Artifacts

legend {
  [connection: "<>", label: "Bidirectional communication"]
  [connection: ">", label: "Data flow"]
  [color: blue, label: "Frontend layer"]
  [color: purple, label: "Backend layer"]
  [color: green, label: "AI Infrastructure"]
}
```

## Bigger Module Connections (Cross-Domain Workflows)

- **The Real-Time Voice Loop (`LiveAgentSession` ↔ `Gemini 2.0 ↔ Frontend`)**:
  When the user streams audio to the React frontend, it's pushed to the Node `WS Proxy`. The proxy forwards this to `Gemini 2.0 Flash`. If Gemini decides it needs outside context (e.g. to search history or generate an image), it delegates standard Function Calls back down the proxy. The `LiveAgentSession` module traps these requests securely on the backend, runs the requested core services (like `RAG`, `Imagen`, or `SessionSearch`), securely injects the result back up to Gemini, AND emits a mirror copy of the payload explicitly down to the `React UI` to visually render the generated Image or Markdown onto the Canvas Workspace in the browser.

- **The Database Orchestration (`Sequelize` ↔ `GCS` ↔ `VectorSearch`)**:
  Uploading a document in the REST API fires off the RAG backend module. Data isn't simply dropped into PG. The `Document` pointer is saved to Sequelize, the large chunk blobs are persisted to Google Cloud Storage (GCS), and the mathematical embeddings for those chunks are upserted into the isolated streaming Vector Search infrastructure for sub-millisecond similarity recall. Deletion must carefully cascade across all 3 storage endpoints.
