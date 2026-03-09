import { WebSocket } from 'ws';
import { GoogleAuth } from 'google-auth-library';
import config from './config.js';

const DEBUG = true;
const GCP_API_HOST = `${config.location}-aiplatform.googleapis.com`;
const SERVICE_URL = `wss://${GCP_API_HOST}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
const MODEL = `projects/${config.projectId}/locations/${config.location}/publishers/google/models/gemini-2.5-flash`;

async function getGcpAccessToken() {
    console.log(`🔑 Fetching GCP Access Token for project: ${config.projectId}...`);
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

async function testLiveApi() {
    try {
        const accessToken = await getGcpAccessToken();
        console.log("✅ Token acquired. Connecting to:", SERVICE_URL);

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        const ws = new WebSocket(SERVICE_URL, { headers });

        ws.on('open', () => {
            console.log("🌐 WebSocket connected! Sending setup message...");

            const setupMessage = {
                setup: {
                    model: MODEL,
                    systemInstruction: {
                        parts: [{ text: "You are a helpful test assistant. Acknowledge this message with a short audio greeting." }]
                    },
                    generationConfig: {
                        responseModalities: ["AUDIO"]
                    }
                }
            };

            ws.send(JSON.stringify(setupMessage));
        });

        ws.on('message', (data) => {
            const str = data.toString();
            console.log("\n📥 Received from Vertex AI:");

            try {
                const parsed = JSON.parse(str);

                if (parsed.serverContent && parsed.serverContent.modelTurn) {
                    const parts = parsed.serverContent.modelTurn.parts;
                    console.log("   Model turns received:", parts.length);
                    for (const part of parts) {
                        if (part.text) {
                            console.log("   Text:", part.text);
                        }
                        if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                            console.log("   Audio chunk received (base64 length):", part.inlineData.data.length);
                            // We received audio successfully, so close the connection
                            console.log("🎉 Success! Audio received. Closing connection.");
                            ws.close(1000, "Test complete");
                        }
                    }
                } else if (parsed.setupComplete) {
                    console.log("   ✅ Setup complete!");

                    // Send a test prompt
                    const promptMessage = {
                        clientContent: {
                            turns: [
                                {
                                    role: 'user',
                                    parts: [{ text: "Hello! Please reply back with a short spoken greeting." }]
                                }
                            ],
                            turnComplete: true
                        }
                    };
                    console.log("🗣️ Sending test prompt...");
                    ws.send(JSON.stringify(promptMessage));
                } else {
                    if (DEBUG) console.log("   Raw JSON:", str.slice(0, 300));
                }
            } catch (e) {
                console.log("   Raw string:", str.slice(0, 300));
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`🔴 Connection closed: ${code} - ${reason}`);
            process.exit(0);
        });

        ws.on('error', (err) => {
            console.error("❌ WebSocket Error:", err.message);
            process.exit(1);
        });

        // Timeout after 15 seconds
        setTimeout(() => {
            console.log("⏱️ Test timed out after 15 seconds.");
            ws.close();
            process.exit(1);
        }, 15000);

    } catch (err) {
        console.error("❌ Failed to start test:", err.message);
        process.exit(1);
    }
}

testLiveApi();
