import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { WorkflowStepper } from '../components/WorkflowStepper';
import { getOrders, advanceStep } from '../services/api';

export const OrdersPage = () => {
  const auth = useContext(AuthContext);
  const t = useTranslation(auth?.lang || 'en');
  const [orders, setOrders] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!auth?.token) return;
    try {
      const data = await getOrders(auth.token);
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders', err);
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

  // Calculate current step index from workflow array
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

  if (loading) return <div className="page-container"><p className="text-secondary">Loading orders...</p></div>;

  return (
    <div className="page-container">
      <h2 className="page-title">{t.orders}</h2>
      {orders.length === 0 ? (
        <div className="glass-card text-center" style={{ padding: '3rem' }}>
          <p className="text-secondary" style={{ fontSize: '1.2rem' }}>{t.noOrders}</p>
          <Link to="/create-order" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
            + Create Your First Order
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => {
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
                    <span className={`status-badge status-${order.status?.toLowerCase()}`}>{order.status}</span>
                  </div>
                </div>

                {expanded === order.id && (
                  <div className="order-details mt-4" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                    {/* Items */}
                    {order.items?.map((item: any) => (
                      <div key={item.id} className="mb-4" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                        <p><strong>{item.description}</strong> — {item.clothColor}, Size: {item.size}</p>
                        <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Measurements: {item.measurements}</p>
                        <p style={{ color: 'var(--accent-3)' }}>৳{item.price}</p>
                        {item.materialsUsed?.length > 0 && (
                          <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                            Materials: {item.materialsUsed.map((m: any) => `${m.name} (${m.quantity} ${m.unit})`).join(', ')}
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Workflow */}
                    <WorkflowStepper
                      currentStep={stepIndex}
                      orderId={order.id}
                      onAdvance={nextStep ? () => handleAdvance(order.id, nextStep) : undefined}
                    />

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
