import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getProducts, createProduct, deleteProduct, getInventory } from '../services/api';

export const ProductsPage = () => {
  const auth = useContext(AuthContext);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Shirt');
  const [basePrice, setBasePrice] = useState('');
  const [defaultMeasurements, setDefaultMeasurements] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState([{ materialId: '', quantity: '' }]);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [auth?.token]);

  const fetchData = async () => {
    if (!auth?.token) return;
    try {
      const [prodData, invData] = await Promise.all([
        getProducts(auth.token),
        getInventory(auth.token)
      ]);
      setProducts(prodData);
      setInventory(invData);
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialChange = (index: number, field: string, value: string) => {
    const newMats = [...selectedMaterials];
    newMats[index] = { ...newMats[index], [field]: value };
    setSelectedMaterials(newMats);
  };

  const addMaterialRow = () => setSelectedMaterials([...selectedMaterials, { materialId: '', quantity: '' }]);
  const removeMaterialRow = (index: number) => {
    if (selectedMaterials.length > 1) {
      setSelectedMaterials(selectedMaterials.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSubmitLoading(true);

    const validMaterials = selectedMaterials
      .filter(m => m.materialId && m.quantity)
      .map(m => ({ materialId: Number(m.materialId), quantity: Number(m.quantity) }));

    const payload = {
      name,
      category,
      basePrice: Number(basePrice),
      defaultMeasurements,
      materials: validMaterials
    };

    try {
      await createProduct(payload, auth.token);
      await fetchData();
      setShowAddForm(false);
      // Reset
      setName('');
      setCategory('Shirt');
      setBasePrice('');
      setDefaultMeasurements('');
      setSelectedMaterials([{ materialId: '', quantity: '' }]);
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!auth?.token || !confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteProduct(id, auth.token);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  if (loading) return <div className="page-container"><p className="text-secondary">Loading products...</p></div>;

  return (
    <div className="page-container">
      <h1 className="page-title">📦 Manage Products</h1>

      {error && <p className="error-text mb-4">{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Create Product'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="glass-card mb-6">
          <h3 className="mb-4 text-xl">Create New Product</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="block mb-1">Product Name</label>
              <input type="text" className="glass-input" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Premium Linen Shirt" />
            </div>
            <div>
              <label className="block mb-1">Category</label>
              <select className="glass-input" required value={category} onChange={e => setCategory(e.target.value)}>
                <option value="Shirt">Shirt</option>
                <option value="Panjabi">Panjabi</option>
                <option value="Pant">Pant</option>
                <option value="Suit">Suit</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block mb-1">Base Price (৳)</label>
              <input type="number" className="glass-input" required value={basePrice} onChange={e => setBasePrice(e.target.value)} placeholder="e.g. 1500" />
            </div>
            <div>
              <label className="block mb-1">Default Measurements (Labels)</label>
              <input type="text" className="glass-input" value={defaultMeasurements} onChange={e => setDefaultMeasurements(e.target.value)} placeholder="e.g. Chest, Length, Collar" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h4 className="mb-3 text-accent-1">BOM: Required Materials</h4>
            {selectedMaterials.map((mat, index) => (
              <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <select className="glass-input flex-1" required value={mat.materialId} onChange={e => handleMaterialChange(index, 'materialId', e.target.value)}>
                  <option value="">Select Material...</option>
                  {inventory.map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.name} (Unit: {inv.unit})</option>
                  ))}
                </select>
                <input
                  type="number" step="0.1" className="glass-input" style={{ width: '100px' }}
                  placeholder="Qty" required value={mat.quantity} onChange={e => handleMaterialChange(index, 'quantity', e.target.value)}
                />
                {selectedMaterials.length > 1 && (
                  <button type="button" onClick={() => removeMaterialRow(index)} className="btn-secondary" style={{ padding: '0 12px', background: 'rgba(239,68,68,0.2)', color: 'var(--error)', border: 'none' }}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-secondary text-sm mt-2" onClick={addMaterialRow}>+ Add Material</button>
          </div>

          <button type="submit" className="btn-primary mt-6 w-full" disabled={submitLoading}>
            {submitLoading ? 'Saving...' : 'Save Product'}
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {products.map(p => (
          <div key={p.id} className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 className="text-xl font-bold">{p.name}</h3>
                <span className="text-secondary text-sm">{p.category}</span>
              </div>
              <span className="font-bold text-accent-2 text-lg">৳{p.basePrice}</span>
            </div>
            
            <div className="mt-4" style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-1)' }}>Required Materials (BOM):</p>
              {p.materials?.length > 0 ? (
                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', fontSize: '0.85rem' }}>
                  {p.materials.map((m: any, i: number) => (
                    <li key={i}>{m.name}: {m.quantity} {m.unit}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-secondary text-sm">No materials linked.</p>
              )}
            </div>
            
            <button onClick={() => handleDelete(p.id)} className="btn-secondary mt-4 w-full" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
              Delete Product
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
