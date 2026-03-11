import express from "express";
import cors from "cors";
import { Agent } from "./agent.js";
import config from "./config.js";
import morgan from "morgan";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch"; // Ensure node-fetch is available if node < 18, but express 5+ usually fine with global fetch

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://agent.elmanasah.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(express.json());
app.use(morgan("dev")); // Standard request logging

// ─── Agent (shared stateful instance) ─────────────────────────────────────────
let agent = new Agent("You are a helpful AI assistant.");

// POST /chat → send a message to the agent
app.post("/chat", async (req, res) => {
  const { message, attachments } = req.body;
  if (!message && (!attachments || attachments.length === 0)) {
    return res
      .status(400)
      .json({ error: "message or attachments are required" });
  }
  try {
    const reply = await agent.sendMessage(message, attachments);
    res.json({ reply });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .json({ error: "Failed to get a response from the AI agent" });
  }
});

// POST /reset → clear conversation history by creating a fresh agent
app.post("/reset", (_req, res) => {
  agent = new Agent("You are a helpful AI assistant.");
  res.json({ status: "ok", message: "Conversation reset" });
});

// GET /token → get a fresh Google Cloud access token
app.get("/token", async (_req, res) => {
  try {
    const client = await auth.getClient();
    const tokenSource = await client.getAccessToken();
    res.json({ token: tokenSource.token });
  } catch (err) {
    console.error("[Token Error]:", err.message);
    res.status(500).json({ error: "Failed to get access token" });
  }
});

// GET /config → get GCP project and location
app.get("/config", (_req, res) => {
  res.json({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
  });
});

// GET / → health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "AI Agent is running 🚀" });
});

// ─── Image Generation (Vertex AI Imagen) ──────────────────────────────────────
const auth = new GoogleAuth({
  scopes: "https://www.googleapis.com/auth/cloud-platform",
});

app.post("/generate-image", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  try {
    const client = await auth.getClient();
    const project = await auth.getProjectId();
    const tokenSource = await client.getAccessToken();
    const accessToken = tokenSource.token;

    const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
    const model = "imagen-3.0-generate-001"; // Falling back to 3.0 if 4.0 fast isn't available, but using user's suggested path structure
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || "Vertex AI Image Generation failed",
      );
    }

    const data = await response.json();
    const base64Image = data.predictions[0].bytesBase64Encoded;

    res.json({
      imageUrl: `data:image/png;base64,${base64Image}`,
      prompt: prompt,
    });
  } catch (err) {
    console.error("[ImageGen Error]:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Gemini Live Proxy (WebSocket) ────────────────────────────────────────────
const DEBUG = process.env.DEBUG === "true";
const GCP_API_HOST =
  process.env.GCP_API_HOST || "us-central1-aiplatform.googleapis.com";
const DEFAULT_SERVICE_URL = `wss://${GCP_API_HOST}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

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

        const isVertex = serviceUrl.includes("aiplatform.googleapis.com");
        const headers = { "Content-Type": "application/json" };
        if (isVertex) {
          headers["Authorization"] = `Bearer ${authData.bearer_token}`;
        }

        serverWs = new WebSocket(serviceUrl, { headers });

        serverWs.on("open", () => {
          gcpReady = true;
          console.log(
            `[proxy] GCP open — flushing ${pendingMessages.length} buffered msg(s)`,
          );

          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ proxy_ready: true }));
          }

          for (const msg of pendingMessages) {
            serverWs.send(msg);
          }
          pendingMessages.length = 0;
        });

        serverWs.on("message", (data) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data.toString());
          }
        });

        serverWs.on("close", (code, reason) => {
          console.log(`[proxy] GCP closed | code: ${code} | reason: ${reason}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(code, reason || "Upstream closed");
          }
        });

        serverWs.on("error", (err) => {
          console.error("[proxy] GCP connection error:", err);
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

    if (!gcpReady) {
      console.log("[proxy] GCP not ready, buffering…");
      pendingMessages.push(raw);
      return;
    }

    if (serverWs?.readyState === WebSocket.OPEN) {
      const parsed = JSON.parse(raw);
      if (parsed.setup)
        console.log("[proxy →GCP setup]", JSON.stringify(parsed, null, 2));
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

server.listen(config.port, () => {
  console.log(`✅ Server running at http://localhost:${config.port}`);
  console.log(`✅ Proxy running at ws://localhost:${config.port}`);
});
