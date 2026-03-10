// generate.js
require("dotenv").config(); // Load environment variables from .env file
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateContent() {
  const apiKey = "AQ.Ab8RN6K4Ie1JYJUzxay8AHrGfmKqaWlyMug_v6u7SEWoM7XuQQ";

  if (!apiKey) {
    console.error(
      "API_KEY not found in .env file. Please create a .env file and add your Google API Key.",
    );
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // For text-only input, use the gemini-pro model
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = "Write a short story about a grumpy wizard who hates magic.";

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    console.log("Generated Story:");
    console.log(text);
  } catch (error) {
    console.error("Error generating content:", error);
  }
}

generateContent();
