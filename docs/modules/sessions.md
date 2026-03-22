# Sessions Module (`src/modules/sessions`)

The Sessions module is the authoritative supervisor for conversational context and historical REST continuity for the application.

## Models

- `Session` (`session.model.js`): Acts as the parent container for a thread. 
   - **Fields**: `id`, `title` (auto-generated based on the first prompt), `userId`.

## Associated Services

- `session.service.js`: Heavily utilizes Sequelize associations (`include: [Message]`) to fetch cascading histories. Handles the fundamental thread scaffolding (`createSession`, `getSession`, `deleteSession`).
- `sessionSearch.service.js`: An advanced internal extraction tool used almost exclusively by Gemini. Uses PostgreSQL querying functionality (`iLike` or similar textual analysis against the `Message` table) to let conversational AI recall historical facts natively from the database without requiring expensive explicit RAG pipeline vectors.

## Endpoints

| Method | Route | Description | Requires Auth |
|---|---|---|---|
| `GET`  | `/api/v1/sessions` | Lists all chat sessions belonging to the authenticated User. Yields minimal metadata. | Yes |
| `GET`  | `/api/v1/sessions/:id` | Yields the specific session AND implicitly executes a SQL `JOIN` (includes) to pull 100% of the `Message` objects mapped beneath it natively. | Yes |
| `DELETE` | `/api/v1/sessions/:id` | Deletes the root Session model. Triggers a database-level `CASCADE` constraint to cleanly wipe all descendant rows from the `messages` table synchronously. | Yes |

## Module Flowchart

```eraser
title Sessions Module Diagram

Client [icon: react, color: blue]
REST API [icon: globe, color: purple] {
  SessionsController [icon: server]
}
Services [icon: cpu, color: orange] {
  SessionService [icon: key]
  SessionSearchService [icon: search]
}
Models [icon: database, color: green] {
  SessionsDB [icon: database]
  MessagesDB [icon: message-square]
}

// Connections
Client <> SessionsController: GET / DELETE via REST
SessionsController <> SessionService: CRUD operations
SessionService <> SessionsDB: Manage parent threads
SessionService <> MessagesDB: Cascade Delete / Foreign Keys
SessionSearchService > MessagesDB: iLike Keyword extraction
```
