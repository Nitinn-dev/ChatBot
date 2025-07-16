// client/src/App.js (MODIFIED - No Database)
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css'; // For basic styling

function App() {
    const [prompt, setPrompt] = useState('');
    const [chatHistory, setChatHistory] = useState([]); // Stores { role: 'user' | 'model', text: '...' }
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const chatContainerRef = useRef(null); // Ref for scrolling to bottom

    // Effect to scroll to the bottom of the chat when history updates
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Removed: useEffect for fetching initial chat history as there's no DB

    const handleSendMessage = async () => {
        if (!prompt.trim() || isLoading) return; // Prevent sending empty messages or multiple requests

        const userMessage = { role: 'user', text: prompt };
        setChatHistory(prev => [...prev, userMessage]); // Add user message to UI immediately
        setPrompt(''); // Clear input field

        setIsLoading(true);
        setError(null);

        try {
            // Send the entire chat history for context to the backend
            const response = await axios.post('http://localhost:5000/api/gemini-chat', {
                message: prompt,
                chatHistory: [...chatHistory, userMessage] // Include the latest user message
            });
            const geminiResponse = response.data.response;

            setChatHistory(prev => [...prev, { role: 'model', text: geminiResponse }]); // Add Gemini's response

        } catch (err) {
            console.error('Error sending message:', err);
            // Remove the last user message if the API call failed to avoid confusion
            setChatHistory(prev => prev.slice(0, prev.length - 1)); // Remove the user's message if there's an error
            setError('Failed to get response from AI. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, not Shift+Enter
            e.preventDefault(); // Prevent new line
            handleSendMessage();
        }
    };

    return (
        <div className="App">
            <h1>Random Chatbot</h1>

            <div className="chat-container" ref={chatContainerRef}>
                {chatHistory.length === 0 && !isLoading && !error && (
                    <div className="no-messages">Type a message to start chatting with Random Chatbot</div>
                )}
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.role}`}>
                        <strong>{msg.role === 'user' ? 'You' : 'Random AI'}:</strong> {msg.text}
                    </div>
                ))}
                {isLoading && <div className="chat-message loading">Random AI is thinking...</div>}
                {error && <div className="error-message">{error}</div>}
            </div>

            <div className="input-area">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onClick={handleKeyPress}
                    placeholder="Type your chat here..."
                    rows="3" // Allow multiple lines for input
                    disabled={isLoading}
                ></textarea>
                <button onClick={handleSendMessage} disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send'}
                </button>
            </div>
        </div>
    );
}

export default App;