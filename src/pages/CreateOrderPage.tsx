import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getProducts, getInventory, createCustomOrder, getClients } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';

interface CartItem {
  id: number; // local unique key
  productId: number;
  productName: string;
  description: string;
  clothColor: string;
  size: string;
  quantity: number;
  price: number;
  measurements: Record<string, string>;
  extraNotes: string;
  materials: { materialId: number; quantity: number; name?: string; unit?: string }[];
}

export const CreateOrderPage = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Client selection
  const [selectedClientId, setSelectedClientId] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [nextId, setNextId] = useState(1);

  // Current item being configured (add-to-cart form)
  const [showItemForm, setShowItemForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [clothColor, setClothColor] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [measurementsObj, setMeasurementsObj] = useState<Record<string, string>>({});
  const [extraNotes, setExtraNotes] = useState('');
  const [productColors, setProductColors] = useState<string[]>([]);
  const [productSizes, setProductSizes] = useState<string[]>([]);
  const [itemMaterials, setItemMaterials] = useState<{ materialId: string; quantity: string; name?: string; unit?: string }[]>([]);

  useEffect(() => {
    if (auth?.token) {
      const p: Promise<any>[] = [getProducts(auth.token), getInventory(auth.token)];
      if (auth.isAdmin || auth.user?.userType === 'user') {
        p.push(getClients(auth.token));
      }
      Promise.all(p)
        .then(([prodData, invData, clientsData]) => {
          setProducts(prodData);
          setInventory(invData);
          if (clientsData) setClients(clientsData);
        })
        .catch(console.error);
    }
  }, [auth?.token, auth?.isAdmin]);

  const resetItemForm = () => {
    setSelectedProductId('');
    setDescription('');
    setPrice('');
    setClothColor('');
    setCustomColor('');
    setSize('');
    setQuantity('1');
    setMeasurementsObj({});
    setExtraNotes('');
    setProductColors([]);
    setProductSizes([]);
    setItemMaterials([]);
  };

  const handleProductSelect = (pid: string) => {
    setSelectedProductId(pid);
    const product = products.find(p => p.id === Number(pid));
    if (product) {
      setDescription(product.name);
      setPrice(String(product.basePrice));

      let newMeasObj: Record<string, string> = {};
      if (product.defaultMeasurements) {
        try {
          const parsed = JSON.parse(product.defaultMeasurements);
          Object.keys(parsed).forEach((key: string) => { newMeasObj[key] = parsed[key] || ''; });
        } catch {
          const labels = product.defaultMeasurements.split(',').map((s: string) => s.trim()).filter((s: string) => s);
          labels.forEach((m: string) => newMeasObj[m] = '');
        }
      } else {
        newMeasObj = { Length: '', Chest: '', Shoulder: '' };
      }
      setMeasurementsObj(newMeasObj);

      const c = product.colors ? product.colors.split(',').map((s: string) => s.trim()).filter((s: string) => s) : [];
      setProductColors(c);
      setClothColor(c.length > 0 ? c[0] : '');
      setCustomColor('');

      const s = product.sizes ? product.sizes.split(',').map((s: string) => s.trim()).filter((s: string) => s) : ['M'];
      setProductSizes(s);
      setSize(s.length > 0 ? s[0] : '');

      setExtraNotes(product.remarks || '');

      if (product.materials && product.materials.length > 0) {
        setItemMaterials(product.materials.map((m: any) => ({
          materialId: String(m.materialId),
          quantity: String(m.quantity),
          name: m.name,
          unit: m.unit
        })));
      } else {
        setItemMaterials([]);
      }
    }
  };

  const addToCart = () => {
    if (!selectedProductId) return;
    const finalColor = clothColor === 'Custom' ? customColor : clothColor;
    const qty = Math.max(1, parseInt(quantity) || 1);

    const item: CartItem = {
      id: nextId,
      productId: Number(selectedProductId),
      productName: products.find(p => p.id === Number(selectedProductId))?.name || description,
      description,
      clothColor: finalColor,
      size,
      quantity: qty,
      price: Number(price),
      measurements: { ...measurementsObj },
      extraNotes,
      materials: itemMaterials.filter(m => m.materialId && m.quantity).map(m => ({
        materialId: Number(m.materialId),
        quantity: Number(m.quantity),
        name: m.name,
        unit: m.unit
      }))
    };

    setCart(prev => [...prev, item]);
    setNextId(prev => prev + 1);
    resetItemForm();
    setShowItemForm(false);
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateCartQuantity = (id: number, newQty: number) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleSubmit = async () => {
    if (!auth?.token) return;
    if (cart.length === 0) {
      setError('Cart is empty. Add at least one product.');
      return;
    }
    setError('');
    setLoading(true);

    // Expand cart items: we now send quantity to backend instead of unrolling
    const allItems: any[] = [];
    for (const cartItem of cart) {
      const formattedMeasurements = Object.entries(cartItem.measurements)
        .filter(([_, val]) => val.trim() !== '')
        .map(([key, val]) => `${key}: ${val}`)
        .join('\n') + (cartItem.extraNotes.trim() ? `\nNotes: ${cartItem.extraNotes}` : '');

      allItems.push({
        description: cartItem.description,
        clothColor: cartItem.clothColor,
        size: cartItem.size,
        measurements: formattedMeasurements,
        price: cartItem.price,
        quantity: cartItem.quantity, // Send quantity directly!
        materials: cartItem.materials.map(m => ({ 
          materialId: m.materialId, 
          // Multiply material per item by quantity to get total materials required for this line item
          quantity: m.quantity * cartItem.quantity 
        }))
      });
    }

    const resolvedName = (auth?.isAdmin || auth?.user?.userType === 'user')
      ? (selectedClientId ? clients.find(c => c.id === Number(selectedClientId))?.name : customerName)
      : auth?.user?.username;

    const payload = {
      customerName: resolvedName,
      clientId: selectedClientId ? Number(selectedClientId) : undefined,
      items: allItems
    };

    try {
      await createCustomOrder(payload, auth.token);
      setToast(`✅ Order created with ${getCartItemCount()} items! Pending Acceptance.`);
      setCart([]);
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

      {/* Step 1: Customer Selection */}
      <div className="glass-card mb-6" style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem' }}>
        <h2 className="font-bold mb-3" style={{ color: 'var(--accent-1)' }}>Step 1: Customer</h2>
        {(auth?.isAdmin || auth?.user?.userType === 'user') ? (
          <div>
            <select className="glass-input w-full mb-2" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
              <option value="">-- Walk-in (Enter name below) --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
            </select>
            {!selectedClientId && (
              <input type="text" className="glass-input w-full" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in Client Name" />
            )}
            {auth?.isAdmin && (
              <div className="mt-2 text-right">
                <Link to="/users" className="text-sm text-accent hover-underline">+ Manage Users/Clients</Link>
              </div>
            )}
          </div>
        ) : (
          <div>
            <input type="text" className="glass-input" disabled value={auth?.user?.username || ''} />
          </div>
        )}
      </div>

      {/* Step 2: Cart Items */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold" style={{ color: 'var(--accent-1)' }}>Step 2: Add Products to Cart</h2>
          {!showItemForm && (
            <button type="button" className="btn-primary" onClick={() => setShowItemForm(true)} style={{ padding: '10px 20px' }}>
              + Add Product
            </button>
          )}
        </div>

        {/* Add Item Form */}
        {showItemForm && (
          <div className="glass-card mb-6" style={{ padding: '1.5rem', border: '1px solid var(--accent-1)', borderRadius: '16px' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Configure Item</h3>
              <button type="button" onClick={() => { resetItemForm(); setShowItemForm(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(20, 184, 166, 0.1)', border: '1px solid var(--accent-1)' }}>
              <label className="block mb-1 font-bold text-accent-1">Select Product</label>
              <select className="glass-input w-full font-bold" value={selectedProductId} onChange={e => handleProductSelect(e.target.value)}>
                <option value="">-- Choose a Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (৳{p.basePrice})</option>
                ))}
              </select>
            </div>

            {selectedProductId && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '1rem' }} className="mb-4">
                  <div>
                    <label className="block mb-1 text-sm font-semibold">Description</label>
                    <input type="text" className="glass-input" value={description} onChange={e => setDescription(e.target.value)} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-semibold">Price (৳)</label>
                    <input type="number" className="glass-input" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-semibold">Qty</label>
                    <input type="number" min="1" className="glass-input" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ textAlign: 'center', fontWeight: '700' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="mb-4">
                  <div>
                    <label className="block mb-1 text-sm font-semibold">Color</label>
                    {productColors.length > 0 ? (
                      <select className="glass-input w-full" value={clothColor} onChange={e => setClothColor(e.target.value)}>
                        <option value="">Select...</option>
                        {productColors.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="Custom">Custom...</option>
                      </select>
                    ) : (
                      <input type="text" className="glass-input w-full" placeholder="Enter color" value={clothColor} onChange={e => setClothColor(e.target.value)} />
                    )}
                    {clothColor === 'Custom' && (
                      <input type="text" className="glass-input w-full mt-2" placeholder="Enter custom color" value={customColor} onChange={e => setCustomColor(e.target.value)} />
                    )}
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-semibold">Size</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {productSizes.map(s => (
                        <button key={s} type="button" onClick={() => setSize(s)}
                          style={{
                            padding: '8px 14px', borderRadius: '8px',
                            background: size === s ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'rgba(0,0,0,0.3)',
                            color: size === s ? '#0a0e1a' : 'var(--text-secondary)',
                            border: size === s ? 'none' : '1px solid var(--glass-border)',
                            fontWeight: size === s ? '700' : '500', cursor: 'pointer', fontSize: '0.85rem'
                          }}
                        >{s}</button>
                      ))}
                      {productSizes.length === 0 && (
                        <input type="text" className="glass-input" placeholder="e.g. M or 38" value={size} onChange={e => setSize(e.target.value)} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Measurements */}
                <div className="mb-4">
                  <label className="block mb-2 text-sm font-semibold">Measurements</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.75rem' }}>
                    {Object.keys(measurementsObj).map(key => (
                      <div key={key}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{key}</label>
                        <input type="text" className="glass-input" placeholder="..." value={measurementsObj[key]} onChange={e => setMeasurementsObj({ ...measurementsObj, [key]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                  <textarea className="glass-input w-full mt-3" rows={2} value={extraNotes} onChange={e => setExtraNotes(e.target.value)} placeholder="Extra notes..." />
                </div>

                {/* Materials BOM */}
                {itemMaterials.length > 0 && (
                  <details className="mb-4" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--accent-1)', fontWeight: '600', fontSize: '0.9rem' }}>📦 Materials ({itemMaterials.length})</summary>
                    <div className="mt-3">
                      {itemMaterials.map((mat, index) => (
                        <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                          <select className="glass-input flex-1" value={mat.materialId} onChange={e => {
                            const newMats = [...itemMaterials];
                            newMats[index] = { ...newMats[index], materialId: e.target.value };
                            setItemMaterials(newMats);
                          }}>
                            <option value="">Select...</option>
                            {inventory.map(inv => (
                              <option key={inv.id} value={inv.id}>{inv.name} (Stock: {inv.stock})</option>
                            ))}
                          </select>
                          <input type="number" step="0.1" className="glass-input" style={{ width: '80px' }} value={mat.quantity} onChange={e => {
                            const newMats = [...itemMaterials];
                            newMats[index] = { ...newMats[index], quantity: e.target.value };
                            setItemMaterials(newMats);
                          }} />
                          <button type="button" onClick={() => setItemMaterials(itemMaterials.filter((_, i) => i !== index))} style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>✕</button>
                        </div>
                      ))}
                      <button type="button" className="btn-secondary text-sm" onClick={() => setItemMaterials([...itemMaterials, { materialId: '', quantity: '' }])}>+ Add Material</button>
                    </div>
                  </details>
                )}

                <button type="button" onClick={addToCart} className="btn-primary w-full" style={{ padding: '12px', fontSize: '1rem' }}>
                  🛒 Add to Cart {quantity && parseInt(quantity) > 1 ? `(${quantity}x)` : ''}
                </button>
              </>
            )}
          </div>
        )}

        {/* Cart Display */}
        {cart.length > 0 && (
          <div className="glass-card mb-6" style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            <h2 className="font-bold mb-4" style={{ color: 'var(--accent-1)' }}>
              🛍️ Cart ({getCartItemCount()} items)
            </h2>

            {cart.map((item, idx) => (
              <div key={item.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', marginBottom: '8px',
                background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                border: '1px solid var(--glass-border)'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '1rem' }}>{item.productName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {item.clothColor} · {item.size} · ৳{item.price}/pc
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                    style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontWeight: '700', minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                  <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                    style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  <span style={{ fontWeight: '700', color: 'var(--accent-1)', minWidth: '80px', textAlign: 'right' }}>৳{item.price * item.quantity}</span>
                  <button type="button" onClick={() => removeFromCart(item.id)}
                    style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', marginLeft: '4px' }}>✕</button>
                </div>
              </div>
            ))}

            {/* Cart Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
              <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>Total</span>
              <span style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--accent-1)' }}>৳{getCartTotal()}</span>
            </div>

            {/* Add More button */}
            {!showItemForm && (
              <button type="button" className="btn-secondary w-full mt-4" onClick={() => setShowItemForm(true)} style={{ padding: '10px' }}>
                + Add Another Product
              </button>
            )}
          </div>
        )}

        {/* Step 3: Submit */}
        {cart.length > 0 && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {error && <p className="error-text mb-4">{error}</p>}
            <button type="button" onClick={handleSubmit} className="btn-primary w-full" disabled={loading}
              style={{ padding: '16px', fontSize: '1.1rem', fontWeight: '700' }}>
              {loading ? 'Creating Order...' : `🛒 Create Pending Order (${getCartItemCount()} items · ৳${getCartTotal()})`}
            </button>
          </div>
        )}

        {/* Empty state */}
        {cart.length === 0 && !showItemForm && (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Your cart is empty. Add products to create an order.</p>
            <button type="button" className="btn-primary" onClick={() => setShowItemForm(true)} style={{ padding: '12px 24px' }}>
              + Add First Product
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
