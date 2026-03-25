# Documents Module (`src/modules/documents`)

The Documents module serves as the primary ingress point for all unstructured knowledge management in Horus. It is distinctly decoupled from conversational components, focusing exclusively on receiving multi-modal uploads and orchestrating their pipeline ingestion into the global Vector environment.

## Models

- `Document` (`document.model.js`): Maps to the `documents` table in PostgreSQL / CockroachDB.
   - **Fields**: `id`, `fileName`, `mimeType`, `chunkIds`
   - **Rationale**: While actual chunk blobs are stored in GCS and their mathematical vectors in Vertex AI, this database table acts as the unified source of truth natively coupling those external `chunkIds` to a specific authenticated `userId`.

## Endpoints

| Method | Route | Description | Requires Auth |
|---|---|---|---|
| `POST` | `/api/v1/documents` | Accepts a base64 or multipart upload. Parses via Gemini OCR if necessary (e.g. PDFs), then invokes the internal RAG ingestion pipeline. | Yes (`Bearer JWT`) |

## Workflows

When a user POSTs a file to `/api/v1/documents`, the module delegates the heavy lifting entirely to the `rag.service.js` orchestrator. It expects the RAG pipeline to fully chunk, vectorize, and persist the upload before responding to the REST client with the newly synthesized global `docId` and chunk count.

## Module Flowchart

```eraser
title Documents Module Diagram

Client [icon: react, color: blue]
REST API [icon: globe, color: purple] {
  DocumentsController [icon: file-text]
}
Internal Engines [icon: box, color: orange] {
  RagService [icon: cpu]
}
Models [icon: database, color: green] {
  DocumentsDB [icon: database]
}

// Connections
Client > DocumentsController: POST /api/v1/documents (Multi-Modal Upload)
DocumentsController > RagService: Async ingestDocument() payload
RagService > DocumentsDB: Save Document Pointer ID record
```
