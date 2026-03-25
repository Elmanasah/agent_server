# RAG Processing Module (`src/modules/rag`)

The RAG (Retrieval-Augmented Generation) module is the invisible nervous system connecting the application's document ingress endpoints with Vertex AI’s semantic retrieval capabilities. It has no public REST endpoints of its own, functioning entirely as an internal library orchestrated by upstream Controllers (`documents` or `agents`).

## Internal Microservices

Because the RAG pipeline is complex and distributed across several cloud products, it is internally partitioned:

1. **`rag.service.js` (The Orchestrator)**: The primary exporter. Exposes `ingestDocument` and `retrieveContext` functions. It weaves the underlying three distinct services below sequentially.
2. **`embedding.service.js`**: Reaches out to Vertex AI (`text-embedding-004`). Ingests 400-word strings and accurately returns normalized mathematical coordinate arrays.
3. **`chunkStorage.service.js`**: Due to strict latency models on conversational streaming, actual chunk text cannot be stored in PG efficiently alongside the chunks. This pipeline streams raw text artifacts into Google Cloud Storage (GCS Bucket) partitioned purely by `userId` and `chunkId`.
4. **`vectorSearch.service.js`**: Connects via HTTPS `google-auth-library` APIs directly to Google’s managed Vertex AI Vector Search index. Executes heavy-duty sub-millisecond Approximate Nearest Neighbor (ANN) math dynamically restricting scopes strictly to specific `userId` namespace tokens for tenant isolation.

## Workflows

### 1. The Ingestion Loop
- Receiver sends raw Base64 bytes.
- OCR pipeline forces Vision model to extract formatted plaintext.
- Service rigidly splits plaintext into overlapped mathematical blocks (400 words apiece).
- Pipeline simultaneously evaluates vector weights, pushes string blobs to GCS, pushes mathematical weightings to Vector DB, and commits parent tracking `Document` to the SQL DB cleanly.

### 2. The Context Loop (`search_knowledge_base`)
- Triggered internally by Gemini Live `FunctionCalling` during a conversation down in `agents` module.
- Service instantly hits the `embedding.service.js` with the query string.
- Takes the query float values over to `vectorSearch.service.js` yielding the `Top 5` closest physical coordinate UUID maps.
- Bootstraps the text from those maps out of `chunkStorage.service.js` remotely, returning the combined physical markdown back up the chain for the LLM context limits.

## Module Flowchart

```eraser
title RAG Module Pipeline Diagram

Trigger Logic [icon: log-in, color: blue]
Orchestrator [icon: cpu, color: purple] {
  RagService [icon: server]
}
Internal Engines [icon: tool, color: orange] {
  EmbeddingService [icon: text]
  VectorSearchService [icon: target]
  ChunkStorageService [icon: hard-drive]
}
Cloud Infrastructure [icon: cloud, color: green] {
  Gemini [label: "text-embedding", icon: star]
  VertexAI [label: "Vector DB", icon: search]
  GCS [label: "Cloud Storage", icon: file]
}

// Connections
Trigger Logic > RagService: Ingest / Query Context
RagService <> EmbeddingService: text -> float tensors
EmbeddingService <> Gemini: API Prediction
RagService <> ChunkStorageService: Push/Pull Text Blobs
ChunkStorageService <> GCS: Google Storage Bucket
RagService <> VectorSearchService: Upsert/Find Neighbors
VectorSearchService <> VertexAI: gRPC Index Search
```
