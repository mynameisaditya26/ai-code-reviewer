import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import Review from "./models/Review.js";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("../frontend")); // serve frontend from project/frontend

const PORT = process.env.PORT || 8080;
const MONGO = process.env.MONGODB_URI || "mongodb://localhost:27017/ai_code_reviewer";

async function start() {
  // Connect MongoDB
  await mongoose.connect(MONGO, {});

  // Initialize Gemini client (reads GEMINI_API_KEY from env automatically)
  const ai = new GoogleGenAI({});

  // basic health route
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // main review route
  app.post("/api/review", async (req, res) => {
    try {
      const { code, filename = "snippet", language = "unspecified" } = req.body;
      if (!code || code.trim().length === 0) {
        return res.status(400).json({ error: "code is required in request body" });
      }

      // Prompt template for Gemini
      const prompt = `
You are a senior software engineer and expert code reviewer. Given the code delimited below, provide a structured review that includes:
1) Short summary of what the code does.
2) Potential bugs or runtime errors (be specific, line references if possible).
3) Security vulnerabilities or risky patterns.
4) Performance / complexity concerns.
5) Style & best-practice suggestions.
6) Concrete suggested fixes — show patched code snippets where appropriate (only show minimal changed sections).
7) Suggested tests (unit/integration) to validate correctness and edge-cases.
8) A final "confidence" line (low/medium/high) and any assumptions you made.

Respond using Markdown. Do not include additional unrelated commentary.

---- Begin code (filename: ${filename}, language: ${language}) ----
\`\`\`${language}
${code}
\`\`\`
---- End code ----
`;

      // Send request to Gemini using generateContent (model gemini-2.5-flash)
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        // optional: you can tweak config.thinkingConfig to reduce latency/cost
        config: {
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      });

      // SDK returns response.text
      const reviewText = response?.text ?? response?.toString?.() ?? "[no response]";

      // save to DB
      const reviewDoc = await Review.create({
        filename,
        language,
        code,
        reviewText
      });

      res.json({
        id: reviewDoc._id,
        reviewText
      });
    } catch (err) {
      console.error("Review error:", err);
      res.status(500).json({ error: "server error", details: err?.message ?? String(err) });
    }
  });

  // list previous reviews (simple)
  app.get("/api/reviews", async (_req, res) => {
    const list = await Review.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json(list);
  });

  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start().catch((e) => {
  console.error("Failed to start", e);
});
