import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getUsers, createUser, updateUser } from '../services/api';

type User = {
  id: number;
  username: string;
  role: string;
  userType: string;
  permissions: any;
  clientId: number;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
};

export const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', userType: 'client', name: '', phone: '', address: '', permissions: { orders: false, billing: false, inventory: false, products: false, createOrder: true } });
  const [submitLoading, setSubmitLoading] = useState(false);

  const auth = useContext(AuthContext);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    if (!auth?.token) return;
    try {
      const data = await getUsers(auth.token);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    if (!newUser.username || !newUser.password) return;
    
    setSubmitLoading(true);
    try {
      // Clean permissions if client type is selected
      const payload = { ...newUser };
      if (payload.userType === 'client') {
        payload.permissions = { orders: true, billing: true, inventory: false, products: false, createOrder: true };
      }
      
      await createUser(payload, auth.token);
      setNewUser({ username: '', password: '', userType: 'client', name: '', phone: '', address: '', permissions: { orders: false, billing: false, inventory: false, products: false, createOrder: true } });
      setShowAddForm(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setSubmitLoading(false);
    }
  };

  const togglePermission = (key: string) => {
    setNewUser(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title mb-0">👥 Users Management</h1>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {error && <p className="error-text mb-4">{error}</p>}

      {showAddForm && (
        <form onSubmit={handleCreateUser} className="glass-card mb-6" style={{ padding: '1.5rem' }}>
          <h2 className="text-xl font-bold mb-4">Create New Account</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Username (Login ID)</label>
              <input type="text" className="glass-input" required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Password</label>
              <input type="text" className="glass-input" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Full Name (Profile)</label>
              <input type="text" className="glass-input" required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Account Type</label>
              <select className="glass-input" value={newUser.userType} onChange={e => setNewUser({ ...newUser, userType: e.target.value })}>
                <option value="client" style={{ color: 'black' }}>Client (Customer)</option>
                <option value="user" style={{ color: 'black' }}>User (Staff)</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Phone (Optional)</label>
              <input type="text" className="glass-input" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Address (Optional)</label>
              <input type="text" className="glass-input" value={newUser.address} onChange={e => setNewUser({ ...newUser, address: e.target.value })} />
            </div>
          </div>

          {newUser.userType === 'user' && (
            <div className="mt-4 p-4 border border-white/10 rounded-xl bg-white/5">
              <h3 className="font-semibold mb-3">Permissions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newUser.permissions.orders} onChange={() => togglePermission('orders')} />
                  Manage Orders
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newUser.permissions.billing} onChange={() => togglePermission('billing')} />
                  Manage Billing
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newUser.permissions.inventory} onChange={() => togglePermission('inventory')} />
                  Manage Inventory
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newUser.permissions.products} onChange={() => togglePermission('products')} />
                  Manage Products
                </label>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary mt-6" disabled={submitLoading}>
            {submitLoading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="glass-card p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="p-4 font-semibold text-secondary">Username</th>
                <th className="p-4 font-semibold text-secondary">Name</th>
                <th className="p-4 font-semibold text-secondary">Type</th>
                <th className="p-4 font-semibold text-secondary">Permissions</th>
                <th className="p-4 font-semibold text-secondary">Phone</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold text-accent">{u.username}</td>
                  <td className="p-4">{u.name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${u.userType === 'user' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                      {u.userType.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-secondary">
                    {u.userType === 'user' ? (
                      Object.entries(u.permissions)
                        .filter(([k, v]) => v && k !== 'createOrder')
                        .map(([k]) => k).join(', ') || 'None'
                    ) : (
                      'Client default'
                    )}
                  </td>
                  <td className="p-4">{u.phone || '-'}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-secondary">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
