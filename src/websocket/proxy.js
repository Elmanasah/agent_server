/**
 * src/websocket/proxy.js
 *
 * Gemini Live WebSocket — Smart Agent Proxy.
 *
 * Flow:
 *   1. Browser connects → sends { jwt_token, service_url? }
 *   2. Server authenticates via JWT, builds system prompt for user
 *   3. Server opens WS to GCP BidiGenerateContent
 *   4. Server intercepts GCP messages that contain functionCall parts
 *   5. Server executes tools (RAG, image gen, DB search) and sends functionResponse to GCP
 *   6. GCP sends final audio/text reply → forwarded to browser
 *
 * @param {import('ws').WebSocketServer} wss
 */

import { WebSocket } from "ws";
import config from "../config/index.js";
import { LiveAgentSession } from "../services/liveAgent.service.js";
import { buildSystemPrompt } from "../config/systemPrompt.js";

const DEFAULT_SERVICE_URL = `wss://${config.gcpApiHost}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

export function attachProxy(wss) {
  wss.on("connection", (clientWs) => {
    const session = new LiveAgentSession(clientWs);
    let gcpWs = null;
    let isAuthenticated = false;
    let gcpReady = false;
    const pendingMessages = [];

    // Kick unauthenticated clients after 10 s
    const authTimeout = setTimeout(() => {
      if (!isAuthenticated) clientWs.close(1008, "Authentication timeout");
    }, 10_000);

    clientWs.on("message", async (rawData) => {
      const raw = rawData.toString();

      // ── Step 1: Authenticate via JWT ──────────────────────────────────
      if (!isAuthenticated) {
        try {
          const authData = JSON.parse(raw);
          // Support both JWT auth (new) and legacy bearer_token (fallback)
          let authResult;
          if (authData.jwt_token) {
            authResult = await session.authenticate(authData);
          } else if (authData.bearer_token) {
            // Legacy support — no user-level tool access
            console.warn(
              "[proxy] Legacy bearer_token auth — tools disabled for this session",
            );
            authResult = {
              systemInstruction: buildSystemPrompt(),
              serviceUrl: authData.service_url,
            };
            // Manually set authenticated so the session still works
            session.isAuthenticated = true;
          } else {
            clientWs.close(1008, "jwt_token or bearer_token required");
            return;
          }

          clearTimeout(authTimeout);
          isAuthenticated = true;

          const serviceUrl =
            authResult.serviceUrl ||
            authData.service_url ||
            DEFAULT_SERVICE_URL;
          const headers = { "Content-Type": "application/json" };

          if (serviceUrl.includes("aiplatform.googleapis.com")) {
            // Use service account auth via google-auth-library
            try {
              const { GoogleAuth } = await import("google-auth-library");
              const auth = new GoogleAuth({
                scopes: "https://www.googleapis.com/auth/cloud-platform",
              });
              const client = await auth.getClient();
              const { token } = await client.getAccessToken();
              headers["Authorization"] = `Bearer ${token}`;
            } catch (authErr) {
              console.warn(
                "[proxy] Could not get SA token, using client token:",
                authErr.message,
              );
              // Fall back to the bearer_token sent by client if available
              if (authData.bearer_token) {
                headers["Authorization"] = `Bearer ${authData.bearer_token}`;
              }
            }
          }

          gcpWs = new WebSocket(serviceUrl, { headers });

          gcpWs.on("open", () => {
            gcpReady = true;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ proxy_ready: true }));
            }
            // Flush buffered messages
            for (const msg of pendingMessages) gcpWs.send(msg);
            pendingMessages.length = 0;
          });

          gcpWs.on("message", async (data) => {
            const rawGcp = data.toString();

            // Let the session handle function calls first
            if (session.isAuthenticated) {
              const handled = await session.handleGcpMessage(rawGcp, gcpWs);
              if (handled) return; // Tool was executed — don't forward to client
            }

            // Forward non-tool GCP messages to browser
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(rawGcp);
            }
          });

          gcpWs.on("close", (code, reason) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close(code, reason || "Upstream closed");
            }
          });

          gcpWs.on("error", (err) => {
            console.error("[proxy] GCP WS error:", err.message);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close(1011, `Upstream error: ${err.message}`);
            }
          });
        } catch (err) {
          console.error("[proxy] Auth error:", err.message);
          clientWs.close(1008, `Auth failed: ${err.message}`);
        }
        return;
      }

      // ── Step 2: Buffer until GCP is ready ────────────────────────────
      if (!gcpReady) {
        pendingMessages.push(raw);
        return;
      }

      // ── Step 3: Forward client messages to GCP ────────────────────────
      if (gcpWs?.readyState === WebSocket.OPEN) {
        gcpWs.send(raw);
      }
    });

    clientWs.on("close", () => {
      clearTimeout(authTimeout);
      if (gcpWs?.readyState === WebSocket.OPEN) gcpWs.close();
    });

    clientWs.on("error", (err) =>
      console.error("[proxy] Client WS error:", err.message),
    );
  });

  console.log("[proxy] Gemini Live WebSocket smart proxy attached");
}
