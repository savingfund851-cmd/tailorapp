import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { getBilling, collectPayment, bulkCollectPayment, getPaymentHistory } from '../services/api';

export const BillingPage = () => {
  const auth = useContext(AuthContext);
  const t = useTranslation(auth?.lang || 'en');
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [bills, setBills] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterInvoice, setFilterInvoice] = useState('');

  // Payment modal
  const [payModal, setPayModal] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAmounts, setBulkAmounts] = useState<Record<number, string>>({});
  const [bulkMode, setBulkMode] = useState(false);

  const fetchData = async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const [b, h] = await Promise.all([
        getBilling(auth.token),
        getPaymentHistory(auth.token)
      ]);
      setBills(b);
      setHistory(h);
    } catch (err) {
      console.error('Failed to load billing data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [auth?.token]);

  // Filter bills
  const filteredBills = bills.filter(b => {
    if (b.billStatus === 'Paid') return false; // Only show pending/partial
    const orderDate = b.createdAt?.split('T')[0] || '';
    if (dateFrom && orderDate < dateFrom) return false;
    if (dateTo && orderDate > dateTo) return false;
    if (filterInvoice && !String(b.id).includes(filterInvoice)) return false;
    return true;
  });

  // Filter history
  const filteredHistory = history.filter(p => {
    const pDate = p.paymentDate?.split('T')[0] || '';
    if (dateFrom && pDate < dateFrom) return false;
    if (dateTo && pDate > dateTo) return false;
    if (filterInvoice && !String(p.orderId).includes(filterInvoice)) return false;
    return true;
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Single payment
  const openPayModal = (bill: any) => {
    const due = Number(bill.total) - Number(bill.paidAmount || 0);
    setPayModal(bill);
    setPayAmount(String(due));
    setPayNote('');
  };

  const handlePay = async () => {
    if (!auth?.token || !payModal) return;
    setPayLoading(true);
    try {
      const result = await collectPayment(payModal.id, Number(payAmount), payNote, auth.token);
      showToast(result.message || '✅ Payment recorded!');
      setPayModal(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Payment failed');
    } finally {
      setPayLoading(false);
    }
  };

  // Bulk selection
  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filteredBills.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredBills.map(b => b.id)));
      // Pre-fill bulk amounts with full due
      const amounts: Record<number, string> = {};
      filteredBills.forEach(b => {
        amounts[b.id] = String(Number(b.total) - Number(b.paidAmount || 0));
      });
      setBulkAmounts(amounts);
    }
  };

  const handleBulkPay = async () => {
    if (!auth?.token || selected.size === 0) return;
    setPayLoading(true);
    try {
      const payments = Array.from(selected).map(orderId => ({
        orderId,
        amount: Number(bulkAmounts[orderId] || 0),
        note: 'Bulk collection'
      })).filter(p => p.amount > 0);

      if (payments.length === 0) {
        alert('Please enter amounts for selected bills');
        setPayLoading(false);
        return;
      }

      const result = await bulkCollectPayment(payments, auth.token);
      showToast(`✅ ${result.results?.length || 0} payment(s) collected!`);
      setSelected(new Set());
      setBulkAmounts({});
      setBulkMode(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Bulk payment failed');
    } finally {
      setPayLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; icon: string }> = {
      'Due': { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', icon: '🔴' },
      'Partial': { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', icon: '🟡' },
      'Paid': { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', icon: '🟢' },
    };
    const s = styles[status] || styles['Due'];
    return (
      <span style={{
        padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
        background: s.bg, color: s.color
      }}>
        {s.icon} {status}
      </span>
    );
  };

  // Totals
  const totalDue = filteredBills.reduce((sum, b) => sum + (Number(b.total) - Number(b.paidAmount || 0)), 0);
  const totalCollected = filteredHistory.reduce((sum, p) => sum + Number(p.amount), 0);

  if (loading) return <div className="page-container"><p className="text-secondary">Loading billing data...</p></div>;

  return (
    <div className="page-container">
      {toast && <div className="toast">{toast}</div>}
      <h2 className="page-title">💰 Billing</h2>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>Total Due</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ef4444' }}>৳{totalDue.toFixed(0)}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>Pending Bills</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#eab308' }}>{filteredBills.length}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>Total Collected</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#22c55e' }}>৳{totalCollected.toFixed(0)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => { setTab('pending'); setDateFrom(''); setDateTo(''); setFilterInvoice(''); }}
          className="btn-secondary"
          style={{
            background: tab === 'pending' ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'rgba(0,0,0,0.3)',
            color: tab === 'pending' ? '#0a0e1a' : 'var(--text-secondary)',
            border: tab === 'pending' ? 'none' : '1px solid var(--glass-border)',
            fontWeight: tab === 'pending' ? '700' : '500',
          }}
        >
          📋 Pending Bills
        </button>
        <button
          onClick={() => { setTab('history'); setDateFrom(''); setDateTo(''); setFilterInvoice(''); }}
          className="btn-secondary"
          style={{
            background: tab === 'history' ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'rgba(0,0,0,0.3)',
            color: tab === 'history' ? '#0a0e1a' : 'var(--text-secondary)',
            border: tab === 'history' ? 'none' : '1px solid var(--glass-border)',
            fontWeight: tab === 'history' ? '700' : '500',
          }}
        >
          📊 Collection History
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>From Date</label>
          <input type="date" className="glass-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '8px' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>To Date</label>
          <input type="date" className="glass-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '8px' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Invoice #</label>
          <input type="text" className="glass-input" placeholder="e.g. 5" value={filterInvoice} onChange={e => setFilterInvoice(e.target.value)} style={{ padding: '8px', width: '100px' }} />
        </div>
        {tab === 'pending' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setBulkMode(!bulkMode)} style={{ padding: '8px 16px', fontSize: '0.85rem', background: bulkMode ? 'var(--accent-1)' : 'rgba(0,0,0,0.3)', color: bulkMode ? '#0a0e1a' : 'var(--text-secondary)' }}>
              {bulkMode ? '✕ Cancel Bulk' : '☑ Bulk Mode'}
            </button>
          </div>
        )}
      </div>

      {/* PENDING BILLS TAB */}
      {tab === 'pending' && (
        <>
          {bulkMode && selected.size > 0 && (
            <div className="glass-card" style={{ padding: '1rem', marginBottom: '16px', background: 'rgba(20, 184, 166, 0.08)', border: '1px solid var(--accent-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <span style={{ fontWeight: '600', color: 'var(--accent-1)' }}>
                  {selected.size} invoice(s) selected — Total: ৳{Array.from(selected).reduce((s, id) => s + Number(bulkAmounts[id] || 0), 0).toFixed(0)}
                </span>
                <button className="btn-primary" onClick={handleBulkPay} disabled={payLoading} style={{ padding: '10px 24px' }}>
                  {payLoading ? 'Processing...' : '💰 Collect All'}
                </button>
              </div>
            </div>
          )}

          {filteredBills.length === 0 ? (
            <div className="glass-card text-center" style={{ padding: '3rem' }}>
              <p className="text-secondary" style={{ fontSize: '1.1rem' }}>🎉 No pending bills!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bulkMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
                  <input type="checkbox" checked={selected.size === filteredBills.length} onChange={selectAll} style={{ width: '18px', height: '18px', accentColor: 'var(--accent-1)' }} />
                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Select All</span>
                </div>
              )}
              {filteredBills.map(bill => {
                const due = Number(bill.total) - Number(bill.paidAmount || 0);
                return (
                  <div key={bill.id} className="glass-card" style={{ padding: '1.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {bulkMode && (
                        <input
                          type="checkbox"
                          checked={selected.has(bill.id)}
                          onChange={() => {
                            toggleSelect(bill.id);
                            if (!bulkAmounts[bill.id]) {
                              setBulkAmounts({ ...bulkAmounts, [bill.id]: String(due) });
                            }
                          }}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--accent-1)', flexShrink: 0 }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <h4 style={{ fontSize: '1rem', marginBottom: '4px' }}>Invoice #{bill.id} — {bill.customerName}</h4>
                            <p className="text-secondary" style={{ fontSize: '0.8rem' }}>{bill.createdAt?.split('T')[0]}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            {getStatusBadge(bill.billStatus)}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
                          <div>
                            <p className="text-secondary" style={{ fontSize: '0.75rem' }}>Total</p>
                            <p style={{ fontWeight: '600', fontSize: '1rem' }}>৳{Number(bill.total).toFixed(0)}</p>
                          </div>
                          <div>
                            <p className="text-secondary" style={{ fontSize: '0.75rem' }}>Paid</p>
                            <p style={{ fontWeight: '600', fontSize: '1rem', color: '#22c55e' }}>৳{Number(bill.paidAmount || 0).toFixed(0)}</p>
                          </div>
                          <div>
                            <p className="text-secondary" style={{ fontSize: '0.75rem' }}>Due</p>
                            <p style={{ fontWeight: '700', fontSize: '1.1rem', color: '#ef4444' }}>৳{due.toFixed(0)}</p>
                          </div>
                        </div>

                        {bulkMode && selected.has(bill.id) ? (
                          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <label className="text-secondary" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Amount:</label>
                            <input
                              type="number"
                              className="glass-input"
                              value={bulkAmounts[bill.id] || ''}
                              onChange={e => setBulkAmounts({ ...bulkAmounts, [bill.id]: e.target.value })}
                              style={{ padding: '6px 10px', width: '120px' }}
                              max={due}
                            />
                            <span className="text-secondary" style={{ fontSize: '0.75rem' }}>/ ৳{due.toFixed(0)}</span>
                          </div>
                        ) : !bulkMode && (
                          <button
                            onClick={() => openPayModal(bill)}
                            className="btn-primary"
                            style={{ marginTop: '12px', padding: '8px 20px', fontSize: '0.9rem' }}
                          >
                            💰 Collect Payment
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* COLLECTION HISTORY TAB */}
      {tab === 'history' && (
        <>
          {filteredHistory.length === 0 ? (
            <div className="glass-card text-center" style={{ padding: '3rem' }}>
              <p className="text-secondary" style={{ fontSize: '1.1rem' }}>No payment records found</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Invoice #</th>
                    <th style={thStyle}>Customer</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(p => (
                    <tr key={p.id} className="glass-card" style={{ marginBottom: '4px' }}>
                      <td style={tdStyle}>{p.paymentDate?.split('T')[0]}</td>
                      <td style={tdStyle}>#{p.orderId}</td>
                      <td style={tdStyle}>{p.customerName}</td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: '#22c55e' }}>৳{Number(p.amount).toFixed(0)}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* PAYMENT MODAL */}
      {payModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '420px', width: '90%', animation: 'fadeIn 0.2s ease' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>💰 Collect Payment — Invoice #{payModal.id}</h3>
            <p className="text-secondary" style={{ marginBottom: '4px' }}>Customer: <strong>{payModal.customerName}</strong></p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', margin: '16px 0', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
              <div>
                <p className="text-secondary" style={{ fontSize: '0.7rem' }}>Total</p>
                <p style={{ fontWeight: '600' }}>৳{Number(payModal.total).toFixed(0)}</p>
              </div>
              <div>
                <p className="text-secondary" style={{ fontSize: '0.7rem' }}>Paid</p>
                <p style={{ fontWeight: '600', color: '#22c55e' }}>৳{Number(payModal.paidAmount || 0).toFixed(0)}</p>
              </div>
              <div>
                <p className="text-secondary" style={{ fontSize: '0.7rem' }}>Remaining</p>
                <p style={{ fontWeight: '700', color: '#ef4444' }}>৳{(Number(payModal.total) - Number(payModal.paidAmount || 0)).toFixed(0)}</p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Payment Amount (৳)</label>
              <input
                type="number"
                className="glass-input"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                max={Number(payModal.total) - Number(payModal.paidAmount || 0)}
                style={{ fontSize: '1.1rem', fontWeight: '700' }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Note (optional)</label>
              <input type="text" className="glass-input" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g. Cash payment" />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" onClick={handlePay} disabled={payLoading} style={{ flex: 1, padding: '12px' }}>
                {payLoading ? 'Processing...' : '✅ Confirm Payment'}
              </button>
              <button className="btn-secondary" onClick={() => setPayModal(null)} style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.15)', color: 'var(--error)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: '0.8rem',
  fontWeight: '600',
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--glass-border)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '0.9rem',
};
