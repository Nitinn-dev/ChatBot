import React, { useState } from 'react';
import axios from 'axios';
import './AuthPage.css';

require('dotenv').config();
const API_URL = process.env.BACK_END_URL;

function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const url = isLogin ? '/api/login' : '/api/register';
      const fullUrl = `${API_URL}${url}`;

      const res = await axios.post(fullUrl, { username, password });
      if (isLogin) {
        localStorage.setItem('token', res.data.token);
        onAuth(res.data.username);
      } else {
        setIsLogin(true);
        setUsername('');
        setPassword('');
        setError('Registration successful! Please log in.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    }
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
      </form>
      <button className="toggle-btn" onClick={() => setIsLogin(l => !l)}>
        {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
      </button>
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}

export default AuthPage;
