import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { changePassword } from '../services/api';

export const ChangePasswordPage = () => {
  const auth = useContext(AuthContext);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (!auth?.token) return;

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword, auth.token);
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container flex justify-center">
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <h2 className="text-xl font-bold mb-6 text-center">Change Password</h2>
        
        {error && <p className="error-text mb-4 text-center">{error}</p>}
        {success && <p className="text-green-400 mb-4 text-center">{success}</p>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group mb-4">
            <label className="block mb-1 text-sm text-secondary">Current Password</label>
            <input
              type="password"
              className="glass-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group mb-4">
            <label className="block mb-1 text-sm text-secondary">New Password</label>
            <input
              type="password"
              className="glass-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group mb-6">
            <label className="block mb-1 text-sm text-secondary">Confirm New Password</label>
            <input
              type="password"
              className="glass-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
