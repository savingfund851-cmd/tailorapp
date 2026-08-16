import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { loginApi } from '../services/api';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useContext(AuthContext);
  const t = useTranslation(auth?.lang || 'en');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const data = await loginApi(username, password);
      auth?.login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-form">
        <h2 className="text-center mb-6">{t.login}</h2>
        {error && <p className="error-text mb-4 text-center">{error}</p>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <input
              type="text"
              className="glass-input"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              id="login-username"
            />
          </div>
          <div className="form-group mt-4">
            <input
              type="password"
              className="glass-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              id="login-password"
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-6" id="btn-submit-login" disabled={loading}>
            {loading ? 'Logging in...' : t.login}
          </button>
        </form>
      </div>
    </div>
  );
};
