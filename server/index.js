const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./user');
const express = require('express');
const app = express();
const router = express.Router();
const cors = require('cors');
// --- Middleware ---
app.use(cors({
    origin: 'https://chat-bot-nine-pi.vercel.app', // Allow requests from your React frontend
    //https://chat-bot-nine-pi.vercel.app
    //http://localhost:3000
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
}));


app.use(express.json()); 
 // Enable parsing of JSON request bodies
app.use('/api', router);


// --- Auth Routes ---
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Username already exists.' });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed });
    await user.save();
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed.' });
    console.error('Error in /api/register:', err);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Invalid credentials.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials.' });
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
  }
});
// server/index.js (MODIFIED - No Database)
require('dotenv').config(); // Load environment variables from .env

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas!');
}).catch(err => {
  console.error('Failed to connect to MongoDB', err);
});

const OwnerInfo = require('./ownerInfo');

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');


// Mount the router at /api

const PORT = process.env.PORT || 5000; // Default to 5000 if PORT is not set
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log(`Using Gemini API Key: ${GEMINI_API_KEY ? '******' : 'Not Set'}`); // Log API key status (masked for security)

// --- Gemini API Initialization ---
if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables!');
    process.exit(1); // Exit if API key is missing
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Or 'gemini-pro-vision' for multimodal

// --- API Routes ---

router.post('/save-owner-info', async (req, res) => {
  try {
    // Check if info already exists to prevent duplicates
    let ownerInfo = await OwnerInfo.findOne();

    if (ownerInfo) {
      // Update existing info
      ownerInfo.name = req.body.name;
      ownerInfo.dob = req.body.dob;
      ownerInfo.name1 = req.body.name1; // Update name1
      await ownerInfo.save();
    } else {
      // Create new info
      ownerInfo = new OwnerInfo(req.body);
      await ownerInfo.save();
    }
    res.status(200).send('Owner info saved successfully!');
  } catch (error) {
    console.error('Error in /api/save-owner-info:', error);
    res.status(500).send('Failed to save owner info.');
  }
});

// Route to handle chat messages
app.post('/api/gemini-chat', async (req, res) => {
    const { message, chatHistory } = req.body;
    

  // Check for keywords
  if (message.includes('creaters name') || message.includes('what is your creaters name')) {
    const ownerInfo = await OwnerInfo.findOne();
    if (ownerInfo) {
      return res.json({ response: `My owner's name is ${ownerInfo.name}.` });
    }
  }

  if (message.includes('creaters dob') || message.includes('creaters date of birth')) {
    const ownerInfo = await OwnerInfo.findOne();
    if (ownerInfo) {
      return res.json({ response: `My owner's date of birth is ${ownerInfo.dob}.` });
    }
  }

  if (message.includes('your name') || message.includes('what is your name')) {
    const ownerInfo = await OwnerInfo.findOne();
    if (ownerInfo) {
      return res.json({ response: `My Name is ${ownerInfo.name1}.` });
    }
  }


// `chatHistory` will be an array of { role, text }

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