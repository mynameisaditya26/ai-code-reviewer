import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Review from "./models/Review.js";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Get current directory (for serving frontend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend (absolute path for Render)
app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = process.env.PORT || 3000;
const MONGO =
  process.env.MONGO_URI ||
  "mongodb+srv://aditya18:Aditya%4009@cluster0.9iuprdw.mongodb.net/drive?retryWrites=true&w=majority";

async function start() {
  // Connect MongoDB
  await mongoose.connect(MONGO, {});
  console.log("✅ Connected to MongoDB");

  // Initialize Gemini client (reads GEMINI_API_KEY from .env)
  const ai = new GoogleGenAI({});

  // Health check
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // ---- Review API ----
  app.post("/api/review", async (req, res) => {
    try {
      const { code, filename = "snippet", language = "unspecified" } = req.body;

      if (!code || !code.trim()) {
        return res.status(400).json({ error: "Code is required." });
      }

      const prompt = `
You are a senior software engineer and expert code reviewer. Given the code delimited below, provide a structured review that includes:
1) Summary of what the code does.
2) Bugs or runtime errors (with line references if possible).
3) Security vulnerabilities or risky patterns.
4) Performance/complexity concerns.
5) Style & best practice suggestions.
6) Suggested fixes (only show minimal changed sections).
7) Suggested tests for correctness and edge cases.
8) A final confidence line (low/medium/high) and any assumptions.

Respond using Markdown.

---- Begin code (filename: ${filename}, language: ${language}) ----
\`\`\`${language}
${code}
\`\`\`
---- End code ----
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });

      const reviewText =
        response?.text ?? response?.toString?.() ?? "[no response]";

      // Save to MongoDB
      const reviewDoc = await Review.create({
        filename,
        language,
        code,
        reviewText,
      });

      res.json({ id: reviewDoc._id, reviewText });
    } catch (err) {
      console.error("❌ Review error:", err);
      res.status(500).json({
        error: "server error",
        details: err?.message ?? String(err),
      });
    }
  });

  // ---- Get all reviews ----
  app.get("/api/reviews", async (_req, res) => {
    const list = await Review.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json(list);
  });

  // ---- Serve frontend (for all routes) ----
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
  });

  app.listen(PORT, () =>
    console.log(`🚀 Server running on http://localhost:${PORT}`)
  );
}

start().catch((e) => {
  console.error("❌ Failed to start:", e);
});
