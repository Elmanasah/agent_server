# Chat Module (`src/modules/chat`)

The Chat module contains the primitives required to handle standard textual and multimodal API requests interacting directly with foundational LLM models, along with the foundational schema logic for conversational history storage.

> Note: For live, real-time Audio conversations utilizing the Bidi Stream, see the `Agents` module. The `Chat` module deals strictly with standard asynchronous HTTP chat payloads.

## Models

- `Message` (`message.model.js`): Maps to the `messages` table in the RDBMS.
   - **Fields**: `id`, `sessionId` (FK), `role` (user, model, system), and `parts`.
   - **`parts` Structure**: Because Horus is deeply multi-modal (attachments, images, tool results, formatted rich text), message content is strongly serialized as `JSONB` utilizing the Gemini universal parts schema (an Array of JSON objects, e.g., `[{ "text": "Hello" }]` or `[{ "inlineData": ... }]`), rather than a traditional flat string column.

## Endpoints

| Method | Route | Description | Requires Auth |
|---|---|---|---|
| `POST` | `/api/v1/chat` | Basic synchronous conversational endpoint evaluating simple prompts directly against the Gemini model without complex tool execution or RAG bindings. | Yes (`Bearer JWT`) |

## Workflows
The module acts as a simplistic entrypoint for standard stateless model calls that do not require heavy backend orchestration. While the foundational `Message` object belongs to this domain concept, actual Session history management and Message persistence workflows are executed aggressively inside the `sessions` module, which imports this schema natively.

## Module Flowchart

```eraser
title Chat Module Diagram

Client [icon: react, color: blue]
REST API [icon: globe, color: purple] {
  ChatController [icon: message-square]
}
Models [icon: database, color: green] {
  MessagesDB [icon: message-square]
}

// Connections
Client > ChatController: POST /api/v1/chat (Stateless Request)
ChatController > MessagesDB: Store multimodal Parts JSONB
```
