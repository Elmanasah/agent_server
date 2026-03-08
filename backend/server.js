import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const DEBUG = process.env.DEBUG === "true";
const GCP_API_HOST = process.env.GCP_API_HOST || "us-central1-aiplatform.googleapis.com";
const DEFAULT_SERVICE_URL = `wss://${GCP_API_HOST}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (clientWs, req) => {
  console.log(`[proxy] New client from ${req.socket.remoteAddress}`);

  let serverWs = null;
  let isAuthenticated = false;
  let gcpReady = false;
  const pendingMessages = [];

  const authTimeout = setTimeout(() => {
    if (!isAuthenticated) {
      console.log("[proxy] Auth timeout – closing client");
      clientWs.close(1008, "Authentication timeout");
    }
  }, 10_000);

  clientWs.on("message", (rawData) => {
    const raw = rawData.toString();

    // ── First message: auth ────────────────────────────────────────────────
    if (!isAuthenticated) {
      try {
        const authData = JSON.parse(raw);
        if (!authData.bearer_token) {
          clientWs.close(1008, "Bearer token missing");
          return;
        }

        clearTimeout(authTimeout);
        isAuthenticated = true;

        const serviceUrl = authData.service_url || DEFAULT_SERVICE_URL;
        console.log(`[proxy] Auth OK → connecting to ${serviceUrl}`);

        serverWs = new WebSocket(serviceUrl, {
          headers: {
            Authorization: `Bearer ${authData.bearer_token}`,
            "Content-Type": "application/json",
          },
        });

        serverWs.on("open", () => {
          gcpReady = true;
          console.log(`[proxy] GCP open — flushing ${pendingMessages.length} buffered msg(s)`);

          // Signal client that GCP is ready — client will now send setup
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ proxy_ready: true }));
          }

          // Flush any messages that arrived before GCP was ready
          for (const msg of pendingMessages) {
            console.log("[proxy →GCP flush]", msg.slice(0, 300));
            serverWs.send(msg);
          }
          pendingMessages.length = 0;
        });

        serverWs.on("message", (data) => {
          const str = data.toString();
          // Always log first few messages to help debug setup issues
          console.log("[proxy ←GCP]", str.slice(0, 200));
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(str);
          }
        });

        serverWs.on("close", (code, reason) => {
          console.log(`[proxy] GCP closed ${code} ${reason}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(1000, "Upstream closed");
          }
        });

        serverWs.on("error", (err) => {
          console.error("[proxy] GCP error:", err.message);
          console.error("[proxy] Likely causes: expired token, wrong project ID, Vertex AI API not enabled");
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(1011, `Upstream error: ${err.message}`);
          }
        });

      } catch (err) {
        console.error("[proxy] Bad auth message:", err.message);
        clientWs.close(1008, "Invalid auth message");
      }
      return;
    }

    // ── Subsequent messages: forward to GCP (buffer if not ready yet) ──────
    if (!gcpReady) {
      if (DEBUG) console.log("[proxy] GCP not ready, buffering…");
      pendingMessages.push(raw);
      return;
    }

    if (serverWs?.readyState === WebSocket.OPEN) {
      // Log setup messages always, others only in debug
      const parsed = JSON.parse(raw);
      if (parsed.setup) console.log("[proxy →GCP setup]", JSON.stringify(parsed, null, 2));
      else if (DEBUG) console.log("[proxy →GCP]", raw.slice(0, 120));
      serverWs.send(raw);
    }
  });

  clientWs.on("close", (code, reason) => {
    console.log(`[proxy] Client disconnected ${code} ${reason}`);
    clearTimeout(authTimeout);
    if (serverWs?.readyState === WebSocket.OPEN) serverWs.close();
  });

  clientWs.on("error", (err) => {
    console.error("[proxy] Client error:", err.message);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Gemini Live proxy → ws://localhost:${PORT}`);
  console.log(`   Health check     → http://localhost:${PORT}/health`);
});
