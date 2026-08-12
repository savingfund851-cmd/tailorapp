import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getProducts, getInventory, createCustomOrder } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface MaterialRow {
  materialId: string;
  quantity: string;
  name?: string;
  unit?: string;
}

export const CreateOrderPage = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  
  // These auto-fill from product, but can be modified
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [clothColor, setClothColor] = useState('');
  const [size, setSize] = useState('');
  const [measurementsObj, setMeasurementsObj] = useState<Record<string, string>>({});
  const [extraMeasurements, setExtraMeasurements] = useState('');
  
  const [productColors, setProductColors] = useState<string[]>([]);
  const [productSizes, setProductSizes] = useState<string[]>([]);
  const [productRemarks, setProductRemarks] = useState('');

  const [selectedMaterials, setSelectedMaterials] = useState<MaterialRow[]>([]);

  useEffect(() => {
    if (auth?.token) {
      Promise.all([getProducts(auth.token), getInventory(auth.token)])
        .then(([prodData, invData]) => {
          setProducts(prodData);
          setInventory(invData);
        })
        .catch(console.error);
    }
  }, [auth?.token]);

  const handleProductSelect = (pid: string) => {
    setSelectedProductId(pid);
    const product = products.find(p => p.id === Number(pid));
    if (product) {
      setDescription(product.name);
      setPrice(String(product.basePrice));
      
      // Setup dynamic measurements — now stored as JSON from product config
      let newMeasObj: Record<string, string> = {};
      if (product.defaultMeasurements) {
        try {
          const parsed = JSON.parse(product.defaultMeasurements);
          // parsed is { Chest: "40", Length: "", ... } — use keys as labels, values as defaults
          Object.keys(parsed).forEach((key: string) => {
            newMeasObj[key] = parsed[key] || '';
          });
        } catch {
          // Fallback: old comma-separated format
          const labels = product.defaultMeasurements.split(',').map((s: string) => s.trim()).filter((s: string) => s);
          labels.forEach((m: string) => newMeasObj[m] = '');
        }
      } else {
        newMeasObj = { Length: '', Chest: '', Shoulder: '' };
      }
      setMeasurementsObj(newMeasObj);

      // Setup Colors & Sizes & Remarks
      const c = product.colors ? product.colors.split(',').map((s: string) => s.trim()).filter((s: string) => s) : [];
      setProductColors(c);
      setClothColor(c.length > 0 ? c[0] : '');

      const s = product.sizes ? product.sizes.split(',').map((s: string) => s.trim()).filter((s: string) => s) : ['M'];
      setProductSizes(s);
      setSize(s.length > 0 ? s[0] : '');
      
      setProductRemarks(product.remarks || '');
      setExtraMeasurements(product.remarks || ''); // preload remarks as extra notes

      // Setup BOM
      if (product.materials && product.materials.length > 0) {
        setSelectedMaterials(product.materials.map((m: any) => ({
          materialId: String(m.materialId),
          quantity: String(m.quantity),
          name: m.name,
          unit: m.unit
        })));
      } else {
        setSelectedMaterials([]);
      }
    }
  };

  const handleMaterialChange = (index: number, field: string, value: string) => {
    const newMats = [...selectedMaterials];
    newMats[index] = { ...newMats[index], [field]: value };
    setSelectedMaterials(newMats);
  };

  const addMaterialRow = () => setSelectedMaterials([...selectedMaterials, { materialId: '', quantity: '' }]);
  const removeMaterialRow = (index: number) => {
    setSelectedMaterials(selectedMaterials.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    if (!selectedProductId) {
      setError('Please select a product first.');
      return;
    }
    setError('');
    setLoading(true);

    const validMaterials = selectedMaterials.filter(m => m.materialId && m.quantity);

    const formattedMeasurements = Object.entries(measurementsObj)
      .filter(([_, val]) => val.trim() !== '')
      .map(([key, val]) => `${key}: ${val}`)
      .join('\n') + (extraMeasurements.trim() ? `\nNotes: ${extraMeasurements}` : '');

    const payload = {
      customerName,
      productId: Number(selectedProductId),
      items: [{
        description,
        clothColor,
        size,
        measurements: formattedMeasurements,
        price: Number(price),
        materials: validMaterials.map(m => ({
          materialId: Number(m.materialId),
          quantity: Number(m.quantity)
        }))
      }]
    };

    try {
      await createCustomOrder(payload, auth.token);
      setToast('✅ Order created! It is now Pending Acceptance.');
      setTimeout(() => { setToast(null); navigate('/orders'); }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      {toast && <div className="toast">{toast}</div>}
      <h1 className="page-title">🛒 Create Order</h1>

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
        {error && <p className="error-text mb-4">{error}</p>}

        <div className="mb-6">
          <label className="block mb-1 font-semibold">Customer Name</label>
          <input type="text" className="glass-input" required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Ahmed Hossain" />
        </div>

        <div className="mb-6 p-4 rounded-lg" style={{ background: 'rgba(20, 184, 166, 0.1)', border: '1px solid var(--accent-1)' }}>
          <label className="block mb-1 font-bold text-accent-1">Select Product Base</label>
          <select className="glass-input w-full font-bold" required value={selectedProductId} onChange={e => handleProductSelect(e.target.value)}>
            <option value="">-- Choose a Product --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} (৳{p.basePrice})</option>
            ))}
          </select>
        </div>

        {selectedProductId && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="mb-6">
              <div>
                <label className="block mb-1 font-semibold">Product Description</label>
                <input type="text" className="glass-input" required value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Price (৳)</label>
                <input type="number" className="glass-input" required value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="mb-6">
              <div>
                <label className="block mb-2 font-semibold">Cloth Color</label>
                {productColors.length > 0 ? (
                  <select className="glass-input w-full" value={clothColor} onChange={e => setClothColor(e.target.value)} required>
                    <option value="">Select Color...</option>
                    {productColors.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Custom">Custom...</option>
                  </select>
                ) : null}
                {(!productColors.length || clothColor === 'Custom') && (
                  <input type="text" className="glass-input w-full mt-2" placeholder="Enter color" required onChange={e => {
                    if (clothColor === 'Custom') {
                      // We don't overwrite clothColor if it's "Custom", wait we need a separate state or just let them type
                    }
                  }} />
                )}
                {/* Real custom handling for color */}
                {(!productColors.length || clothColor === 'Custom') ? (
                  <input type="text" className="glass-input w-full mt-2" placeholder="Enter color" value={clothColor === 'Custom' ? '' : clothColor} onChange={e => setClothColor(e.target.value)} required />
                ) : null}
              </div>

              <div>
                <label className="block mb-2 font-semibold">Size</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {productSizes.map(s => (
                    <button
                      key={s} type="button" onClick={() => setSize(s)}
                      style={{
                        padding: '10px 18px', borderRadius: '10px',
                        background: size === s ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'rgba(0,0,0,0.3)',
                        color: size === s ? '#0a0e1a' : 'var(--text-secondary)', border: size === s ? 'none' : '1px solid var(--glass-border)',
                        fontWeight: size === s ? '700' : '500', cursor: 'pointer',
                      }}
                    >{s}</button>
                  ))}
                  {productSizes.length === 0 && (
                    <input type="text" className="glass-input" placeholder="e.g. M or 38" value={size} onChange={e => setSize(e.target.value)} required />
                  )}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block mb-2 font-semibold">Measurements</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                {Object.keys(measurementsObj).map(key => (
                  <div key={key}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{key}</label>
                    <input type="text" className="glass-input" placeholder="..." value={measurementsObj[key]} onChange={e => setMeasurementsObj({ ...measurementsObj, [key]: e.target.value })} />
                  </div>
                ))}
              </div>
              <label className="block mb-1 font-semibold mt-4">Remarks / Notes</label>
              <textarea className="glass-input" rows={2} value={extraMeasurements} onChange={e => setExtraMeasurements(e.target.value)} placeholder="Extra Tailoring Notes..." />
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
              <h3 className="mb-4" style={{ color: 'var(--accent-1)', fontSize: '1rem', fontWeight: '600' }}>📦 Editable BOM (From Product)</h3>
              {selectedMaterials.map((mat, index) => (
                <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  <select className="glass-input flex-1" required value={mat.materialId} onChange={e => handleMaterialChange(index, 'materialId', e.target.value)}>
                    <option value="">Select Material...</option>
                    {inventory.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.name} (Stock: {inv.stock})</option>
                    ))}
                  </select>
                  <input type="number" step="0.1" className="glass-input" style={{ width: '100px' }} placeholder="Qty" required value={mat.quantity} onChange={e => handleMaterialChange(index, 'quantity', e.target.value)} />
                  <button type="button" onClick={() => removeMaterialRow(index)} style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
              ))}
              <button type="button" className="btn-secondary text-sm" onClick={addMaterialRow} style={{ marginTop: '4px' }}>+ Add Material</button>
            </div>

            <button type="submit" className="btn-primary w-full mt-6" style={{ padding: '14px', fontSize: '1.05rem' }} disabled={loading}>
              {loading ? 'Creating Order...' : '🛒 Create Pending Order'}
            </button>
          </>
        )}
      </form>
    </div>
  );
};
