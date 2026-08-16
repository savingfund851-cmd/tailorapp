import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getClients, createClient } from '../services/api';

type Client = {
  id: number;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
};

export const ClientsPage = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', address: '' });
  const [submitLoading, setSubmitLoading] = useState(false);

  const auth = useContext(AuthContext);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    if (!auth?.token) return;
    try {
      const data = await getClients(auth.token);
      setClients(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    if (!newClient.name) return;
    
    setSubmitLoading(true);
    try {
      await createClient(newClient, auth.token);
      setNewClient({ name: '', phone: '', address: '' });
      setShowAddForm(false);
      fetchClients();
    } catch (err: any) {
      setError(err.message || 'Failed to create client');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title mb-0">👥 Clients</h1>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ New Client'}
        </button>
      </div>

      {error && <p className="error-text mb-4">{error}</p>}

      {showAddForm && (
        <form onSubmit={handleCreateClient} className="glass-card mb-6" style={{ padding: '1.5rem' }}>
          <h2 className="text-xl font-bold mb-4">Add New Client</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Name</label>
              <input 
                type="text" 
                className="glass-input" 
                required 
                value={newClient.name}
                onChange={e => setNewClient({ ...newClient, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Phone</label>
              <input 
                type="text" 
                className="glass-input" 
                value={newClient.phone}
                onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-secondary">Address</label>
              <input 
                type="text" 
                className="glass-input" 
                value={newClient.address}
                onChange={e => setNewClient({ ...newClient, address: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary mt-4" disabled={submitLoading}>
            {submitLoading ? 'Saving...' : 'Save Client'}
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
                <th className="p-4 font-semibold text-secondary">ID</th>
                <th className="p-4 font-semibold text-secondary">Name</th>
                <th className="p-4 font-semibold text-secondary">Phone</th>
                <th className="p-4 font-semibold text-secondary">Address</th>
                <th className="p-4 font-semibold text-secondary">Added On</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">#{client.id}</td>
                  <td className="p-4 font-bold">{client.name}</td>
                  <td className="p-4">{client.phone || '-'}</td>
                  <td className="p-4">{client.address || '-'}</td>
                  <td className="p-4">{client.createdAt.split('T')[0]}</td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-secondary">No clients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
