import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getInventory, createCustomOrder } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface MaterialRow {
  materialId: string;
  quantity: string;
}

export const CreateOrderPage = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [description, setDescription] = useState('');
  const [clothColor, setClothColor] = useState('');
  const [size, setSize] = useState('M');
  const [measurementsObj, setMeasurementsObj] = useState({
    Chest: '',
    Length: '',
    Shoulder: '',
    Sleeve: '',
    Waist: '',
    Collar: ''
  });
  const [extraMeasurements, setExtraMeasurements] = useState('');
  const [price, setPrice] = useState('');
  const [clothImage, setClothImage] = useState('');

  // Dynamic materials state
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialRow[]>([{ materialId: '', quantity: '' }]);

  useEffect(() => {
    getInventory().then(setInventory).catch(console.error);
  }, []);

  const handleMaterialChange = (index: number, field: string, value: string) => {
    const newMats = [...selectedMaterials];
    newMats[index] = { ...newMats[index], [field]: value };
    setSelectedMaterials(newMats);
  };

  const addMaterialRow = () => {
    setSelectedMaterials([...selectedMaterials, { materialId: '', quantity: '' }]);
  };

  const removeMaterialRow = (index: number) => {
    if (selectedMaterials.length > 1) {
      setSelectedMaterials(selectedMaterials.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setError('');
    setLoading(true);

    const validMaterials = selectedMaterials.filter(m => m.materialId && m.quantity);

    const formattedMeasurements = Object.entries(measurementsObj)
      .filter(([_, val]) => val.trim() !== '')
      .map(([key, val]) => `${key}: ${val}`)
      .join('\n') + (extraMeasurements.trim() ? `\nExtra: ${extraMeasurements}` : '');

    const payload = {
      customerName,
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
      setToast('✅ Order created successfully! Raw materials deducted from inventory.');
      setTimeout(() => { setToast(null); navigate('/orders'); }, 2500);

      // Reset
      setCustomerName('');
      setDescription('');
      setClothColor('');
      setMeasurementsObj({ Chest: '', Length: '', Shoulder: '', Sleeve: '', Waist: '', Collar: '' });
      setExtraMeasurements('');
      setPrice('');
      setSelectedMaterials([{ materialId: '', quantity: '' }]);
      // Refresh inventory
      getInventory().then(setInventory);
    } catch (err: any) {
      setError(err.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const colorOptions = [
    { name: 'Navy Blue', hex: '#1e3a5f' },
    { name: 'Black', hex: '#1a1a1a' },
    { name: 'White', hex: '#f0f0f0' },
    { name: 'Charcoal', hex: '#36454f' },
    { name: 'Maroon', hex: '#800000' },
    { name: 'Olive', hex: '#556b2f' },
    { name: 'Royal Blue', hex: '#4169e1' },
    { name: 'Cream', hex: '#fffdd0' },
    { name: 'Grey', hex: '#808080' },
    { name: 'Brown', hex: '#654321' },
  ];

  return (
    <div className="page-container">
      {toast && <div className="toast">{toast}</div>}
      <h1 className="page-title">✂️ Create Custom Order</h1>

      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
        {error && <p className="error-text mb-4">{error}</p>}

        {/* Customer Info */}
        <div className="mb-6">
          <label className="block mb-1">Customer Name</label>
          <input type="text" className="glass-input" required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Ahmed Hossain" id="order-customer-name" />
        </div>

        {/* Product Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="mb-6">
          <div>
            <label className="block mb-1">Product / Code</label>
            <input type="text" className="glass-input" required value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Formal Shirt, Panjabi" id="order-description" />
          </div>
          <div>
            <label className="block mb-1">Price (৳)</label>
            <input type="number" className="glass-input" required value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 1500" id="order-price" />
          </div>
        </div>

        {/* Cloth Image (optional) */}
        <div className="mb-6">
          <label className="block mb-1">Cloth Image URL (optional)</label>
          <input type="url" className="glass-input" value={clothImage} onChange={e => setClothImage(e.target.value)} placeholder="Paste image link of cloth..." id="order-cloth-image" />
          {clothImage && (
            <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', maxWidth: '200px' }}>
              <img src={clothImage} alt="Cloth preview" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
            </div>
          )}
        </div>

        {/* Color Selection */}
        <div className="mb-6">
          <label className="block mb-2">Cloth Color</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {colorOptions.map(c => (
              <button
                key={c.name}
                type="button"
                onClick={() => setClothColor(c.name)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: c.hex,
                  border: clothColor === c.name ? '3px solid var(--accent-1)' : '2px solid var(--glass-border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: clothColor === c.name ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: clothColor === c.name ? '0 0 10px rgba(20,184,166,0.4)' : 'none'
                }}
                title={c.name}
              />
            ))}
          </div>
          {clothColor && <p style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--accent-1)' }}>Selected: {clothColor}</p>}
        </div>

        {/* Size Selection */}
        <div className="mb-6">
          <label className="block mb-2">Size</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['S', 'M', 'L', 'XL', 'XXL'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  background: size === s ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'rgba(0,0,0,0.3)',
                  color: size === s ? '#0a0e1a' : 'var(--text-secondary)',
                  border: size === s ? 'none' : '1px solid var(--glass-border)',
                  fontWeight: size === s ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Body Measurements */}
        <div className="mb-6">
          <label className="block mb-2">Body Measurements</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {Object.keys(measurementsObj).map(key => (
              <div key={key}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{key}</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="..." 
                  value={measurementsObj[key as keyof typeof measurementsObj]} 
                  onChange={e => setMeasurementsObj({ ...measurementsObj, [key]: e.target.value })} 
                />
              </div>
            ))}
          </div>
          <label className="block mb-1" style={{ fontSize: '0.85rem' }}>Extra Notes / Measurements (Optional)</label>
          <textarea 
            className="glass-input" 
            rows={2} 
            value={extraMeasurements} 
            onChange={e => setExtraMeasurements(e.target.value)} 
            placeholder="Any other specific instructions..." 
            style={{ resize: 'vertical' }} 
          />
        </div>

        {/* BOM — Raw Material Consumption */}
        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
          <h3 className="mb-4" style={{ color: 'var(--accent-1)', fontSize: '1rem', fontWeight: '600' }}>📦 Raw Material Consumption (BOM)</h3>

          {selectedMaterials.map((mat, index) => (
            <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              <select className="glass-input flex-1" required value={mat.materialId} onChange={e => handleMaterialChange(index, 'materialId', e.target.value)} id={`material-select-${index}`}>
                <option value="">Select Material...</option>
                {inventory.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.name} (Stock: {inv.stock} {inv.unit})</option>
                ))}
              </select>
              <input
                type="number"
                step="0.1"
                className="glass-input"
                style={{ width: '100px' }}
                placeholder="Qty"
                required
                value={mat.quantity}
                onChange={e => handleMaterialChange(index, 'quantity', e.target.value)}
                id={`material-qty-${index}`}
              />
              {selectedMaterials.length > 1 && (
                <button type="button" onClick={() => removeMaterialRow(index)} style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary text-sm" onClick={addMaterialRow} style={{ marginTop: '4px' }}>+ Add Material</button>
        </div>

        <button type="submit" className="btn-primary w-full mt-6" style={{ padding: '14px', fontSize: '1.05rem' }} disabled={loading} id="btn-submit-order">
          {loading ? 'Creating Order...' : '✂️ Create Custom Order'}
        </button>
      </form>
    </div>
  );
};
