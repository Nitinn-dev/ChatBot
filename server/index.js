// server/index.js (MODIFIED - No Database)
require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 5000; // Default to 5000 if PORT is not set
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log(`Using Gemini API Key: ${GEMINI_API_KEY ? '******' : 'Not Set'}`); // Log API key status (masked for security)

// --- Middleware ---
app.use(cors({
    origin: 'https://chat-bot-nine-pi.vercel.app', // Allow requests from your React frontend
    credentials: true
}));
app.use(express.json()); // Enable parsing of JSON request bodies

// --- Gemini API Initialization ---
if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables!');
    process.exit(1); // Exit if API key is missing
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Or 'gemini-pro-vision' for multimodal

// --- API Routes ---

// Route to handle chat messages
app.post('/api/gemini-chat', async (req, res) => {
    const { message, chatHistory } = req.body; // `chatHistory` will be an array of { role, text }

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // Map frontend chatHistory to Gemini API format
        const apiFormattedHistory = chatHistory.map(entry => ({
            role: entry.role === 'user' ? 'user' : 'model',
            parts: [{ text: entry.text }]
        }));

        const chat = model.startChat({
            history: apiFormattedHistory,
            generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.9,
                topP: 1,
                topK: 1
            },
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
            ],
        });

        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        res.json({ response: responseText });

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Failed to get response from AI. Please try again.' });
    }
});

// We are removing the /api/chat-history GET endpoint as there's no DB.
// This means chat history will only persist for the current browser session.

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});