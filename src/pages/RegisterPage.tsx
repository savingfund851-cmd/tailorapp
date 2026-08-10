import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { registerApi } from '../services/api';

export const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useContext(AuthContext);
  const t = useTranslation(auth?.lang || 'en');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!username || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const data = await registerApi(username, password);
      auth?.login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-form">
        <h2 className="text-center mb-6">{t.register}</h2>
        {error && <p className="error-text mb-4 text-center">{error}</p>}
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <input
              type="text"
              className="glass-input"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              id="register-username"
            />
          </div>
          <div className="form-group mt-4">
            <input
              type="password"
              className="glass-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              id="register-password"
            />
          </div>
          <div className="form-group mt-4">
            <input
              type="password"
              className="glass-input"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              id="register-confirm-password"
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-6" id="btn-submit-register" disabled={loading}>
            {loading ? 'Creating account...' : t.register}
          </button>
        </form>
        <p className="text-center mt-4 text-secondary">
          Already have an account? <Link to="/login" className="text-accent hover-underline">Login</Link>
        </p>
      </div>
    </div>
  );
};
