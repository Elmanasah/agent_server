# Horus Agent Server

A production-ready Node.js & Express server facilitating a deeply integrated multimodal RAG chat environment heavily rooted in Google Cloud's AI suite. 

The application utilizes CockroachDB (via PostgreSQL driver + Sequelize) for stateful entity tracking, while deploying unstructured multimodal storage seamlessly across Google Cloud Storage buckets and Vertex AI Vector Search indexes. It simultaneously acts as a secure reverse WebSocket proxy bridging browser-based React tools with the interactive Gemini 2.0 Live API.

## Project Structure (Module Domain Architecture)

The codebase has been refactored away from monolithic flat design into decoupled modular layers defined inside `src/modules/`:
* `agents/`: Defines the real-time WebSocket proxy engine that intercepts tool execution loops from Gemini Live.
* `auth/`: Centralizes OTP registration, JWT issuance, and scoped GCP Service Account sub-token provisioning.
* `chat/` & `sessions/`: Governs synchronous HTTP inference logic alongside relational conversational history bindings in CockroachDB.
* `documents/` & `rag/`: Bridges HTTP uploads to the backend NLP chunking scripts, translating text into math vectors pushed to Google Vertex AI.
* `image/` & `mail/`: Cloud-centric peripheral workflows (Imagen3 logic and Nodemailer integrations).

## Installation & Setup

Ensure you have Node.js 22+ running and `npm` available globally.
```bash
npm install
```

### Environment Variables
Due to the profound integration with both database clusters and external Cloud tools, you must populate an `.env` file at the root of `/server` defining the following schema strictly:

```env
# Server Binding
PORT=5000
NODE_ENV=development # or production

# Relational Database Connections
DATABASE_URL=postgresql://usr:pass@free-tier.cockroachlabs.cloud:26257/horusdb
TEST_DATABASE_URL=postgresql://usr:pass@free-tier.cockroachlabs.cloud:26257/horus_test_db

# Security
SECRET_KEY=your_extremely_secure_jwt_string

# Mailer Configurations (Nodemailer binding for OTP loops)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=admin@example.com
MAIL_PASS=secure_app_password

# Google Cloud Platform (AI / GCS / Vector Bindings)
GOOGLE_CLOUD_PROJECT=your_gcp_project_id
GOOGLE_CLOUD_LOCATION=us-central1
GCS_BUCKET_NAME=horus-rag-documents
VECTOR_INDEX_ID=1234567890
VECTOR_ENDPOINT_ID=0987654321
```

> [!IMPORTANT]
> Because Horus deeply leverages Vertex AI logic on the backend, the Node environment must have secure permissions to call Google resources on behalf of the `GOOGLE_CLOUD_PROJECT`. For local testing, execute `gcloud auth application-default login` securely through your standalone terminal. The codebase evaluates standard ADC resolution securely alongside the `.env`.

### Running the App

```bash
# Sync database relations and schema (only once)
npm run db:sync

# Start the continuous hot-reload development server
npm run dev

# Start in production memory
npm run start
```

## Running Tests

Testing is natively executed using Jest utilizing pure ECMAScript (`--experimental-vm-modules`) against ephemeral local testing databases mocked synchronously. 

```bash
# Test completely natively on the developer environment
npm test
```

> [!TIP]
> **Continuous Integration Pipelines:** If deploying over platforms lacking GCP credentials (e.g., standard GitHub Actions builds without Workload Identity setups), run `npm run test:ci`. This customized script universally bypasses the Cloud-centric modules (`agents`, `rag`, `gcp`) to natively validate schema integrity seamlessly without halting standard deployments over network resolution errors.