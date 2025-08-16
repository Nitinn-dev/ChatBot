// index.js — Production-stable Express server for Render + Vercel
// Notes:
// - No wildcard "*" paths in app.options (we don't need app.options at all)
// - CORS configured for preflight
// - Strict env checks so the app fails fast with a clear message
// - Healthcheck endpoints for Render
// - Works on Node 18/20/22; recommend pinning Node 20.x in package.json

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// --- Models ---
const User = require("./user");
const OwnerInfo = require("./ownerInfo");

// --- Gemini ---
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// --- App ---
const app = express();

// --- Required ENV ---
const requiredEnv = ["MONGO_URI", "JWT_SECRET", "GEMINI_API_KEY"];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing required environment variables:", missing.join(", "));
  process.exit(1);
}

const PORT = process.env.PORT || 5000; // Render provides PORT

// --- Middleware ---
app.set("trust proxy", 1); // good practice on Render/behind proxy
app.use(express.json({ limit: "1mb" }));

const allowedOrigins = [
  "http://localhost:3000",
  "https://chat-bot-nine-pi.vercel.app",
];

app.use(
  cors({
    origin: function (origin, cb) {
      // Allow mobile apps / curl (no origin) and allowed list in prod
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS: Origin not allowed: " + origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    optionsSuccessStatus: 200, // ensures older browsers don’t choke on 204
  })
);

// Express + cors will automatically handle OPTIONS preflight for declared routes.
// No need for app.options("*") which can break on Node 22.

// --- Healthcheck ---
app.get("/health", (req, res) => res.status(200).json({ ok: true }));
app.get("/api/health", (req, res) => res.status(200).json({ ok: true }));

// --- DB Connect ---
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err?.message || err);
    process.exit(1);
  });

// --- Gemini init ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- API Router ---
const router = express.Router();

// Auth: /api/register
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username and password required." });

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Username already exists." });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed });
    await user.save();

    return res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    console.error("/api/register error:", err);
    return res.status(500).json({ error: "Registration failed." });
  }
});

// Auth: /api/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username and password required." });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "Invalid credentials." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials." });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "1d" });
    return res.json({ token, username: user.username });
  } catch (err) {
    console.error("/api/login error:", err);
    return res.status(500).json({ error: "Login failed." });
  }
});

// OwnerInfo: /api/save-owner-info
router.post("/save-owner-info", async (req, res) => {
  try {
    let ownerInfo = await OwnerInfo.findOne();
    if (ownerInfo) {
      ownerInfo.name = req.body.name;
      ownerInfo.dob = req.body.dob;
      ownerInfo.name1 = req.body.name1;
      await ownerInfo.save();
    } else {
      ownerInfo = new OwnerInfo(req.body);
      await ownerInfo.save();
    }
    return res.status(200).send("Owner info saved successfully!");
  } catch (err) {
    console.error("/api/save-owner-info error:", err);
    return res.status(500).send("Failed to save owner info.");
  }
});

// Chat: /api/gemini-chat
router.post("/gemini-chat", async (req, res) => {
  try {
    const { message, chatHistory = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Quick keyword replies from OwnerInfo
    const lower = message.toLowerCase();
    if (lower.includes("creaters name") || lower.includes("what is your creaters name")) {
      const ownerInfo = await OwnerInfo.findOne();
      if (ownerInfo) return res.json({ response: `My owner's name is ${ownerInfo.name}.` });
    }
    if (lower.includes("creaters dob") || lower.includes("creaters date of birth")) {
      const ownerInfo = await OwnerInfo.findOne();
      if (ownerInfo) return res.json({ response: `My owner's date of birth is ${ownerInfo.dob}.` });
    }
    if (lower.includes("your name") || lower.includes("what is your name")) {
      const ownerInfo = await OwnerInfo.findOne();
      if (ownerInfo) return res.json({ response: `My Name is ${ownerInfo.name1}.` });
    }

    // Map frontend chatHistory to Gemini API format
    const apiHistory = Array.isArray(chatHistory)
      ? chatHistory.map((h) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: String(h.text || "") }],
        }))
      : [];

    const chat = geminiModel.startChat({
      history: apiHistory,
      generationConfig: { maxOutputTokens: 1000, temperature: 0.9, topP: 1, topK: 1 },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    const result = await chat.sendMessage(message);
    const responseText = result?.response?.text?.() || "";

    return res.json({ response: responseText });
  } catch (err) {
    console.error("/api/gemini-chat error:", err);
    return res.status(500).json({ error: "Failed to get response from AI. Please try again." });
  }
});

// Mount API router
app.use("/api", router);

// Fallback 404 for unknown routes (avoid 405 confusion)
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// --- Start ---
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
