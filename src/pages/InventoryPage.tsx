import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getInventory, apiPost, updateInventoryStock, deleteInventoryItem } from '../services/api';

export const InventoryPage = () => {
  const auth = useContext(AuthContext);
  const [inventory, setInventory] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Stock Entry Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialUnit, setNewMaterialUnit] = useState('meters');
  const [newMaterialStock, setNewMaterialStock] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    const fetchInventory = async () => {
      if (!auth?.token) return;
      try {
        const data = await getInventory(auth.token);
        setInventory(data);
      } catch (err) {
        setError('Failed to fetch inventory');
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, [auth?.token]);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSubmitLoading(true);
    try {
      await apiPost('/inventory', {
        name: newMaterialName,
        unit: newMaterialUnit,
        stock: Number(newMaterialStock)
      }, auth.token);
      
      // Refresh inventory
      const data = await getInventory(auth.token);
      setInventory(data);
      
      // Reset form
      setNewMaterialName('');
      setNewMaterialStock('');
      setShowAddForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to add stock');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUpdateStock = async (id: number, currentName: string) => {
    if (!auth?.token) return;
    const amountStr = window.prompt(`How much to adjust for "${currentName}"? (Use - for negative)`);
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (isNaN(amount)) {
      alert('Please enter a valid number');
      return;
    }
    const adminPassword = window.prompt(`Enter Admin Password to confirm adjustment for ${currentName}:`);
    if (!adminPassword) return;

    try {
      await updateInventoryStock(id, amount, adminPassword, auth.token);
      const data = await getInventory(auth.token);
      setInventory(data);
    } catch (err: any) {
      alert(err.message || 'Failed to update stock');
    }
  };

  const handleDeleteItem = async (id: number, currentName: string) => {
    if (!auth?.token) return;
    if (!window.confirm(`Are you sure you want to delete "${currentName}"? This will also remove it from any Product recipes.`)) return;
    
    const adminPassword = window.prompt(`Enter Admin Password to confirm deletion of ${currentName}:`);
    if (!adminPassword) return;

    try {
      await deleteInventoryItem(id, adminPassword, auth.token);
      const data = await getInventory(auth.token);
      setInventory(data);
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  const getStockLevel = (stock: number) => {
    if (stock <= 0) return { label: 'Out of Stock', color: 'var(--error)' };
    if (stock < 50) return { label: 'Low Stock', color: 'var(--warning)' };
    return { label: 'In Stock', color: 'var(--success)' };
  };

  if (loading) return <div className="page-container"><p className="text-secondary">Loading inventory...</p></div>;

  return (
    <div className="page-container">
      <h1 className="page-title">📦 Raw Materials Inventory</h1>

      {error && <p className="error-text mb-4">{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add Stock'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddStock} className="glass-card mb-6" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label className="block mb-1">Material Name</label>
            <input type="text" className="glass-input" required placeholder="e.g. Red Thread" value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} />
          </div>
          <div style={{ width: '120px' }}>
            <label className="block mb-1">Unit</label>
            <select className="glass-input" required value={newMaterialUnit} onChange={e => setNewMaterialUnit(e.target.value)}>
              <option value="meters">Meters</option>
              <option value="pcs">Pieces</option>
              <option value="spools">Spools</option>
              <option value="yards">Yards</option>
            </select>
          </div>
          <div style={{ width: '120px' }}>
            <label className="block mb-1">Quantity</label>
            <input type="number" className="glass-input" required placeholder="e.g. 50" value={newMaterialStock} onChange={e => setNewMaterialStock(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={submitLoading} style={{ padding: '12px 24px', height: '46px' }}>
            {submitLoading ? 'Saving...' : 'Save Stock'}
          </button>
        </form>
      )}

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(20, 184, 166, 0.06)' }}>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Material</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stock</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unit</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map(item => {
              const stockInfo = getStockLevel(item.stock);
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s ease' }}>
                  <td style={{ padding: '14px 20px', fontWeight: '500' }}>{item.name}</td>
                  <td style={{ padding: '14px 20px', fontWeight: '700', color: stockInfo.color, fontSize: '1.05rem' }}>{item.stock}</td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>{item.unit}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: `${stockInfo.color}20`,
                      color: stockInfo.color
                    }}>
                      {stockInfo.label}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleUpdateStock(item.id, item.name)} 
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', marginRight: '8px' }}
                    >
                      ✏️ Adjust Inventory
                    </button>
                    <button 
                      onClick={() => handleDeleteItem(item.id, item.name)} 
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
