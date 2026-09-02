import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getUsers, createUser, updateUser, deleteUser } from '../services/api';

type User = {
  id: number;
  username: string;
  role: string;
  userType: string;
  permissions: any;
  status: string;
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
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', userType: 'client', name: '', phone: '', address: '', status: 'active', permissions: { orders: false, billing: false, inventory: false, products: false, createOrder: true } });
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
    if (!newUser.username) return;
    if (!editingUserId && !newUser.password) return;
    
    setSubmitLoading(true);
    try {
      // Clean permissions if client type is selected
      const payload = { ...newUser };
      if (payload.userType === 'client') {
        payload.permissions = { orders: true, billing: true, inventory: false, products: false, createOrder: true };
      }
      
      if (editingUserId) {
        await updateUser(editingUserId, payload, auth.token);
      } else {
        await createUser(payload, auth.token);
      }
      
      setNewUser({ username: '', password: '', userType: 'client', name: '', phone: '', address: '', permissions: { orders: false, billing: false, inventory: false, products: false, createOrder: true } });
      setShowAddForm(false);
      setEditingUserId(null);
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

  const handleEditClick = (u: User) => {
    setEditingUserId(u.id);
    setNewUser({
      username: u.username,
      password: '', // don't load password
      userType: u.userType,
      name: u.name,
      phone: u.phone,
      address: u.address,
      status: u.status,
      permissions: u.permissions || { orders: false, billing: false, inventory: false, products: false, createOrder: true }
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (!auth?.token) return;
    if (!window.confirm(`Are you sure you want to permanently delete user "${username}"? This cannot be undone.`)) return;
    
    try {
      await deleteUser(id, auth.token);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    if (!auth?.token) return;
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await updateUser(id, { status: newStatus }, auth.token);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  if (loading) return <div className="page-container"><p className="text-secondary">Loading users...</p></div>;

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title mb-0">👥 Users Management</h1>
        <button className="btn-primary" onClick={() => {
          if (showAddForm) {
            setShowAddForm(false);
            setEditingUserId(null);
            setNewUser({ username: '', password: '', userType: 'client', name: '', phone: '', address: '', status: 'active', permissions: { orders: false, billing: false, inventory: false, products: false, createOrder: true } });
          } else {
            setShowAddForm(true);
          }
        }}>
          {showAddForm ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {error && <p className="error-text mb-4">{error}</p>}

      {showAddForm && (
        <form onSubmit={handleCreateUser} className="glass-card mb-6" style={{ padding: '1.5rem' }}>
          <h2 className="text-xl font-bold mb-4">{editingUserId ? 'Edit Account' : 'Create New Account'}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Username (Login ID)</label>
              <input type="text" className="glass-input" required value={newUser.username} disabled={!!editingUserId} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">{editingUserId ? 'New Password (Leave blank to keep current)' : 'Password'}</label>
              <input type="text" className="glass-input" required={!editingUserId} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Full Name (Profile)</label>
              <input type="text" className="glass-input" required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Account Type</label>
              <select className="glass-input" value={newUser.userType} disabled={!!editingUserId} onChange={e => setNewUser({ ...newUser, userType: e.target.value })}>
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
            {submitLoading ? 'Saving...' : editingUserId ? 'Update Account' : 'Create Account'}
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
                <th className="p-4 font-semibold text-secondary">Status</th>
                <th className="p-4 font-semibold text-secondary">Permissions</th>
                <th className="p-4 font-semibold text-secondary text-right">Actions</th>
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
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${u.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                      {u.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-secondary">
                    {u.userType === 'user' ? (
                      Object.entries(u.permissions || {})
                        .filter(([k, v]) => v && k !== 'createOrder')
                        .map(([k]) => k).join(', ') || 'None'
                    ) : (
                      'Client default'
                    )}
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button className="btn-secondary text-sm px-3 py-1" onClick={() => handleToggleStatus(u.id, u.status)}>
                      {u.status === 'active' ? '🚫 Deactivate' : '✅ Activate'}
                    </button>
                    <button className="btn-secondary text-sm px-3 py-1" onClick={() => handleEditClick(u)}>
                      ✏️ Edit
                    </button>
                    <button 
                      style={{ padding: '4px 12px', fontSize: '0.875rem', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                      onClick={() => handleDeleteUser(u.id, u.username)}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-secondary">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
