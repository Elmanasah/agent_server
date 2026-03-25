# Horus Interactive API Map

This directory broadly synthesizes the REST endpoints explicitly made available by the backend architecture natively. For profound specifics defining the *purpose* or internal logic behind these endpoints, please exclusively review their specific counterpart pages cleanly segmented across `docs/modules/*.md`.

> Note: The `/ws` URL patterns serving Gemini Live Audio streaming are excluded from REST mappings as they serve exclusively as stateful persistent real-time socket endpoints handled by the `agents` backend routing hierarchy automatically.

## Authentication Hierarchy (`/api/v1/auth`)
| Method | Route | Body | Description |
|---|---|---|---|
| `POST` | `/register` | `{ name, email, password }` | Constructs `Unverified` row logic across RDBMS + NodeMailer OTP loop mappings. |
| `POST` | `/login` | `{ email, password }` | Returns `{ token, user }` if the account status is logically verified natively. |
| `POST` | `/verify` | `{ email, code }` | Hydrates `OTP` model validations matching specific user bounds successfully. |
| `GET` | `/token` | `Authorization: Bearer` | Generates a scoped, short-lived temporary GCP impersonation object token seamlessly explicitly intended for React to execute explicit Vertex operations safely. |

## Internal Session Persistence (`/api/v1/sessions`)
| Method | Route | Body | Description |
|---|---|---|---|
| `GET` | `/` | `Authorization: Bearer` | Iterates root-level history threads without cascading large SQL `includes`. |
| `GET` | `/:id` | `Authorization: Bearer` | Dumps entire textual / generated artifact memory explicitly tracked inside the `Message` table. |
| `DELETE` | `/:id` | `Authorization: Bearer` | Wipes the fundamental SQL hierarchy cleanly cascading down the relational trees strictly. |

## Knowledge Expansion (`/api/v1/documents`)
| Method | Route | Body | Description |
|---|---|---|---|
| `POST` | `/` | `{ fileName, mimeType, base64Data }` | Forwards multimedia bytes definitively across the specialized `rag` pipeline engines dynamically orchestrating embeddings + vector uploads successfully. |

## Textual Fallbacks (`/api/v1/chat`)
| Method | Route | Body | Description |
|---|---|---|---|
| `POST` | `/` | `{ sessionId, role, parts }` | Acts as a rigid, stateless REST execution of simple text operations outside of the real-time WebSocket paradigm mappings safely. |
