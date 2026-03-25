/**
 * src/server.js
 *
 * Entry point — creates the HTTP server, attaches the WebSocket proxy,
 * connects Sequelize to CockroachDB (syncs tables), then starts listening.
 */
// no one touch this file it have no bussiness logic so keep away

import { createServer } from "http";
import { WebSocketServer } from "ws";

import app from "./app.js";
import config from "./config/index.js";
import { sequelize } from "./models/index.js";
import { attachProxy } from "./websocket/proxy.js";
import { initUsageScheduler } from "./services/usageScheduler.js";  // ← ADD THIS
import { runMigrations } from "./utils/runMigrations.js";          // ← ADD THIS

// ── HTTP + WebSocket server ────────────────────────────────────────────────────
const server = createServer(app);
const wss = new WebSocketServer({ server });

attachProxy(wss);

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Verify DB connection
    await sequelize.authenticate();
    console.log("✅ Database  connected to CockroachDB");
    await runMigrations();    
    initUsageScheduler();    
    console.log("✅ Scheduler usage reset job started");  // ← add this                                   // ← ADD THIS
    // CockroachDB does not support Sequelize's multi-statement ALTER
    // uncomment this if you need to update the db collections other don't touch it please
    // await sequelize.sync({ force: true, alter: true });
    // console.log("✅ Database  tables synced");

    server.listen(config.port, () => {
      console.log(`✅ Server    running at http://localhost:${config.port}`);
      console.log(`✅ WebSocket running at ws://localhost:${config.port}`);
      console.log(
        `✅ RAG       ${config.ragEnabled ? "enabled ✓" : "disabled — set VECTOR_SEARCH_INDEX_ID"}`,
      );
      console.log(`✅ Env       ${config.nodeEnv}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal) {
  console.log(`\n[server] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    await sequelize.close();
    console.log("[server] Database disconnected. Bye! 👋");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
