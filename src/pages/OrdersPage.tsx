import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { WorkflowStepper } from '../components/WorkflowStepper';
import { getOrders, advanceStep, acceptOrder, rejectOrder } from '../services/api';

export const OrdersPage = () => {
  const auth = useContext(AuthContext);
  const t = useTranslation(auth?.lang || 'en');
  const [orders, setOrders] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Pending Acceptance' | 'Processing' | 'Delivered'>('All');

  const fetchOrders = async () => {
    if (!auth?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getOrders(auth.token);
      setOrders(data);
    } catch (err: any) {
      console.error('Failed to load orders', err);
      setError(err.message || 'Server is waking up or connection failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [auth?.token]);

  const handleAdvance = async (orderId: number, stepName: string) => {
    if (!auth?.token) return;
    try {
      await advanceStep(orderId, stepName, auth.token);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to advance step');
    }
  };

  const handleAccept = async (orderId: number) => {
    if (!auth?.token) return;
    try {
      await acceptOrder(orderId, auth.token);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to accept order (Check inventory)');
    }
  };

  const handleReject = async (orderId: number) => {
    if (!auth?.token) return;
    try {
      await rejectOrder(orderId, auth.token);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to reject order');
    }
  };

  const getCurrentStepIndex = (workflow: any[]) => {
    if (!workflow) return 0;
    const sorted = [...workflow].sort((a, b) => a.id - b.id);
    const firstIncomplete = sorted.findIndex(s => !s.completed);
    return firstIncomplete === -1 ? sorted.length : firstIncomplete;
  };

  const getNextStepName = (workflow: any[]) => {
    if (!workflow) return null;
    const sorted = [...workflow].sort((a, b) => a.id - b.id);
    const next = sorted.find(s => !s.completed);
    return next ? next.step : null;
  };

  const filteredOrders = orders.filter(o => {
    if (filter === 'All') return true;
    if (filter === 'Pending Acceptance') return o.status === 'Pending Acceptance';
    if (filter === 'Delivered') return o.status === 'Delivered';
    // Processing includes anything in between
    return o.status !== 'Pending Acceptance' && o.status !== 'Delivered' && o.status !== 'Rejected';
  });

  if (loading) return <div className="page-container"><p className="text-secondary">Loading orders...</p></div>;

  return (
    <div className="page-container">
      {error && (
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #eab308', background: 'rgba(234, 179, 8, 0.1)' }}>
          <p style={{ color: '#eab308', fontWeight: '600', marginBottom: '8px' }}>⚠️ Connection Note: Server may be waking up or session expired.</p>
          <button className="btn-secondary" onClick={fetchOrders} style={{ padding: '6px 16px', fontSize: '0.85rem', background: 'var(--accent-1)', color: '#0a0e1a' }}>
            🔄 Retry Loading Orders
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
        {['All', 'Pending Acceptance', 'Processing', 'Delivered'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`btn-secondary ${filter === f ? 'active-filter' : ''}`}
            style={{
              background: filter === f ? 'var(--accent-1)' : 'rgba(0,0,0,0.3)',
              color: filter === f ? '#0a0e1a' : 'var(--text-secondary)',
              border: filter === f ? 'none' : '1px solid var(--glass-border)'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="glass-card text-center" style={{ padding: '3rem' }}>
          <p className="text-secondary" style={{ fontSize: '1.2rem' }}>{t.noOrders}</p>
          <Link to="/create-order" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
            + Create Your First Order
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map(order => {
            const stepIndex = getCurrentStepIndex(order.workflow);
            const nextStep = getNextStepName(order.workflow);
            return (
              <div key={order.id} className="glass-card order-card" id={`order-${order.id}`}>
                <div
                  className="order-header"
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.1rem' }}>Order #{order.id} — {order.customerName}</h3>
                    <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{order.createdAt?.split('T')[0]}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="font-bold" style={{ fontSize: '1.2rem' }}>৳{order.total}</p>
                    <span className={`status-badge status-${order.status?.toLowerCase().replace(' ', '-')}`}>{order.status}</span>
                  </div>
                </div>

                {expanded === order.id && (
                  <div className="order-details mt-4" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                    {order.status === 'Pending Acceptance' && (
                      <div className="mb-4 p-4 rounded-lg" style={{ background: 'rgba(239, 160, 11, 0.1)', border: '1px solid var(--warning)' }}>
                        <p className="mb-2 font-semibold" style={{ color: 'var(--warning)' }}>⚠️ This order requires acceptance. Accepting will deduct inventory stock.</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => handleAccept(order.id)} className="btn-primary" style={{ background: 'var(--success)', color: '#fff' }}>✅ Accept Order</button>
                          <button onClick={() => handleReject(order.id)} className="btn-secondary" style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--error)' }}>❌ Reject</button>
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    {order.items?.map((item: any) => (
                      <div key={item.id} className="mb-4" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                        <p><strong>{item.description}</strong> — {item.clothColor}, Size: {item.size}</p>
                        <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Measurements: {item.measurements}</p>
                        <p style={{ color: 'var(--accent-3)' }}>৳{item.price}</p>
                        {item.materialsUsed?.length > 0 && (
                          <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                            Materials Required: {item.materialsUsed.map((m: any) => `${m.name} (${m.quantity} ${m.unit})`).join(', ')}
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Workflow */}
                    {order.status !== 'Pending Acceptance' && order.status !== 'Rejected' && (
                      <WorkflowStepper
                        currentStep={stepIndex}
                        orderId={order.id}
                        onAdvance={nextStep ? () => handleAdvance(order.id, nextStep) : undefined}
                      />
                    )}

                    {/* Invoice link */}
                    {order.status === 'Delivered' && (
                      <Link to={`/orders/${order.id}/invoice`} className="btn-secondary mt-4 block text-center" id={`view-invoice-${order.id}`}>
                        {t.viewDetails} / Invoice
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
