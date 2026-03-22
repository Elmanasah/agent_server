# Google Cloud Infrastructure

The Horus application leans heavily into a decoupled, managed AI infrastructure. Because relational SQL bounds are entirely unsuited for generative artificial intelligence vectors and multimedia models, we strictly orchestrate the following interconnected services across GCP.

## Resource Taxonomy

### 1. Object Storage (GCS)
- **Bucket Usage**: Standard unstructured chunks of text that the RAG ingestor creates out of larger uploaded `.pdf` documents are dispatched to Google Cloud Storage alongside base64 PNGs outputted from the `Imagen` service. 
- **Rationale**: The RDBMS manages merely the standard *pointers* bridging user identities cleanly to their generated Google Cloud blobs without bloating Postgres performance ceilings.

### 2. Vertex AI: Vector Search Index
Instead of standard SQL text tracking like `pgvector`, Horus pushes RAG vectors towards Google's highly native managed Approximate Nearest Neighbors (ANN) indices on Vertex AI.
- **Topology**: The `vectorSearch.service.js` binds exclusively via gRPC endpoints utilizing `user.id` namespaces exclusively to prevent global LLM context leaks. Vertex returns the top 5 nearest `chunkId` neighbor coordinates against a user's prompt invisibly in ~25 milliseconds.

### 3. Vertex AI Modules
Rather than simply resolving standard REST URLs, the Node server uses the native `@google-cloud/aiplatform` gRPC bindings to execute parallel threads.
- **text-embedding-004**: Employed fundamentally inside `embedding.service.js` uniformly converting user ingestion queries and raw RAG chunks into mathematically universal multi-dimensional float vectors strictly.
- **Imagen 3**: Resolves specific visual-generative operations triggered exclusively down the `LiveAgentSession` socket streams securely resolving generated `.png` renders contextually across conversational prompts.

## Security (ADC Resolution)
Because the `agents` WebSocket modules directly stream real-byte payloads back to Google’s newest Bidi (Bidirectional) Sockets on Vertex Live, standard API keys are fully insufficient. 
The application secures identity universally by relying strictly on Application Default Credentials (ADC) configured either implicitly via your local `gcloud auth login` daemon, or via explicitly mapped JSON Service Account keys in deployed production Kubernetes/VM layers natively.
