import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { getBilling, collectPayment, bulkCollectPayment, getPaymentHistory, getBillingInvoicePdf } from '../services/api';

export const BillingPage = () => {
  const auth = useContext(AuthContext);
  const t = useTranslation(auth?.lang || 'en');
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [viewType, setViewType] = useState<'client' | 'invoice'>('client');
  
  const [bills, setBills] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterClient, setFilterClient] = useState('');
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
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      if (b.billStatus === 'Paid') return false; // Only show pending/partial
      const orderDate = b.createdAt?.split('T')[0] || '';
      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo && orderDate > dateTo) return false;
      if (filterInvoice && !String(b.id).includes(filterInvoice)) return false;
      if (filterClient && !b.customerName?.toLowerCase().includes(filterClient.toLowerCase())) return false;
      return true;
    });
  }, [bills, dateFrom, dateTo, filterInvoice, filterClient]);

  // Group pending bills by Client Name
  const clientGroups = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredBills.forEach(b => {
      const name = b.customerName || 'Unknown Client';
      if (!map[name]) map[name] = [];
      map[name].push(b);
    });
    return Object.entries(map).map(([clientName, clientBills]) => {
      const totalDue = clientBills.reduce((sum, b) => sum + (Number(b.total) - Number(b.paidAmount || 0)), 0);
      const totalAmount = clientBills.reduce((sum, b) => sum + Number(b.total), 0);
      const totalPaid = clientBills.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0);
      return { clientName, totalDue, totalAmount, totalPaid, bills: clientBills };
    });
  }, [filteredBills]);

  // Filter history
  const filteredHistory = useMemo(() => {
    return history.filter(p => {
      const pDate = p.paymentDate?.split('T')[0] || '';
      if (dateFrom && pDate < dateFrom) return false;
      if (dateTo && pDate > dateTo) return false;
      if (filterInvoice && !String(p.orderId).includes(filterInvoice)) return false;
      if (filterClient && !p.customerName?.toLowerCase().includes(filterClient.toLowerCase())) return false;
      return true;
    });
  }, [history, dateFrom, dateTo, filterInvoice, filterClient]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Single payment modal
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

  // Select all invoices for a specific client
  const selectClientInvoices = (clientBills: any[]) => {
    setBulkMode(true);
    const nextSelected = new Set(selected);
    const nextAmounts = { ...bulkAmounts };
    clientBills.forEach(b => {
      nextSelected.add(b.id);
      const due = Number(b.total) - Number(b.paidAmount || 0);
      nextAmounts[b.id] = String(due);
    });
    setSelected(nextSelected);
    setBulkAmounts(nextAmounts);
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
        alert('Please enter valid amounts for selected bills');
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

  const handleDownloadBillingInvoice = async (orderId: number) => {
    if (!auth?.token) return;
    try {
      const blob = await getBillingInvoicePdf(orderId, auth.token);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BillingInvoice-ORD${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download billing invoice');
    }
  };

  const handlePrintBillingInvoice = async (orderId: number) => {
    if (!auth?.token) return;
    try {
      const blob = await getBillingInvoicePdf(orderId, auth.token);
      const url = URL.createObjectURL(blob as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      alert('Failed to open billing invoice for printing');
    }
  };

  if (loading) return <div className="page-container"><p className="text-secondary">Loading billing data...</p></div>;

  return (
    <div className="page-container">
      {toast && <div className="toast">{toast}</div>}
      <h2 className="page-title">💰 Billing & Payment Collection</h2>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>Total Due</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ef4444' }}>৳{totalDue.toFixed(0)}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>Pending Clients / Bills</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#eab308' }}>
            {clientGroups.length} Clients ({filteredBills.length} Bills)
          </p>
        </div>
        <div className="glass-card" style={{ padding: '1.2rem', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>Total Collected</p>
          <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#22c55e' }}>৳{totalCollected.toFixed(0)}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => { setTab('pending'); setDateFrom(''); setDateTo(''); setFilterClient(''); setFilterInvoice(''); }}
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
          onClick={() => { setTab('history'); setDateFrom(''); setDateTo(''); setFilterClient(''); setFilterInvoice(''); }}
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

        {tab === 'pending' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewType('client')}
              className="btn-secondary"
              style={{
                padding: '8px 16px', fontSize: '0.85rem',
                background: viewType === 'client' ? 'var(--accent-1)' : 'rgba(0,0,0,0.3)',
                color: viewType === 'client' ? '#0a0e1a' : 'var(--text-secondary)',
                fontWeight: viewType === 'client' ? '700' : 'normal'
              }}
            >
              👤 Client View
            </button>
            <button
              onClick={() => setViewType('invoice')}
              className="btn-secondary"
              style={{
                padding: '8px 16px', fontSize: '0.85rem',
                background: viewType === 'invoice' ? 'var(--accent-1)' : 'rgba(0,0,0,0.3)',
                color: viewType === 'invoice' ? '#0a0e1a' : 'var(--text-secondary)',
                fontWeight: viewType === 'invoice' ? '700' : 'normal'
              }}
            >
              📄 Invoice View
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Client Name</label>
          <input
            type="text"
            className="glass-input"
            placeholder="Search Client..."
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            style={{ padding: '8px', width: '150px' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Invoice #</label>
          <input
            type="text"
            className="glass-input"
            placeholder="e.g. 5"
            value={filterInvoice}
            onChange={e => setFilterInvoice(e.target.value)}
            style={{ padding: '8px', width: '100px' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>From Date</label>
          <input type="date" className="glass-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '8px' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>To Date</label>
          <input type="date" className="glass-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '8px' }} />
        </div>
        {tab === 'pending' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button
              className="btn-secondary"
              onClick={() => setBulkMode(!bulkMode)}
              style={{
                padding: '8px 16px', fontSize: '0.85rem',
                background: bulkMode ? 'var(--accent-1)' : 'rgba(0,0,0,0.3)',
                color: bulkMode ? '#0a0e1a' : 'var(--text-secondary)'
              }}
            >
              {bulkMode ? '✕ Cancel Bulk' : '☑ Bulk Mode'}
            </button>
          </div>
        )}
      </div>

      {/* PENDING BILLS TAB */}
      {tab === 'pending' && (
        <>
          {bulkMode && auth?.isAdmin && (
            <div className="glass-card" style={{ padding: '1rem', marginBottom: '16px', background: 'rgba(20, 184, 166, 0.08)', border: '1px solid var(--accent-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <span style={{ fontWeight: '600', color: 'var(--accent-1)' }}>
                  {selected.size} invoice(s) selected — Total: ৳{Array.from(selected).reduce((s, id) => s + Number(bulkAmounts[id] || 0), 0).toFixed(0)}
                </span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button className="btn-secondary" onClick={selectAll} style={{ padding: '10px 20px' }}>
                    {selected.size === filteredBills.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button className="btn-primary" onClick={handleBulkPay} disabled={payLoading || selected.size === 0} style={{ padding: '10px 24px' }}>
                    {payLoading ? 'Processing...' : '💰 Collect Selected'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredBills.length === 0 ? (
            <div className="glass-card text-center" style={{ padding: '3rem' }}>
              <p className="text-secondary" style={{ fontSize: '1.1rem' }}>🎉 No pending bills found!</p>
            </div>
          ) : viewType === 'client' ? (
            /* CLIENT-WISE VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {clientGroups.map(group => (
                <div key={group.clientName} className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-1)' }}>
                  {/* Client Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '1rem', paddingBottom: '0.8rem', borderBottom: '1px solid var(--glass-border)' }}>
                    <div>
                      <h3 style={{ fontSize: '1.3rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        👤 Client: <span className="gradient-text">{group.clientName}</span>
                      </h3>
                      <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                        {group.bills.length} Pending Invoice(s)
                      </p>
                    </div>
                      {auth?.isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <p className="text-secondary" style={{ fontSize: '0.75rem' }}>Client Total Due</p>
                            <p style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ef4444' }}>৳{group.totalDue.toFixed(0)}</p>
                          </div>
                          <button
                            className="btn-secondary"
                            onClick={() => selectClientInvoices(group.bills)}
                            style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(20, 184, 166, 0.2)', color: 'var(--accent-1)', fontWeight: '600' }}
                          >
                            ☑ Select Client Bills
                          </button>
                        </div>
                      )}
                  </div>

                  {/* Invoices List under Client */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {group.bills.map(bill => {
                      const due = Number(bill.total) - Number(bill.paidAmount || 0);
                      return (
                        <div key={bill.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
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
                                  <h4 style={{ fontSize: '1rem', fontWeight: '700' }}>
                                    Invoice #{bill.id}
                                  </h4>
                                  <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Date: {bill.createdAt?.split('T')[0]}</p>
                                </div>
                                <div>
                                  {getStatusBadge(bill.billStatus)}
                                </div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '10px' }}>
                                <div>
                                  <p className="text-secondary" style={{ fontSize: '0.75rem' }}>Total</p>
                                  <p style={{ fontWeight: '600', fontSize: '0.95rem' }}>৳{Number(bill.total).toFixed(0)}</p>
                                </div>
                                <div>
                                  <p className="text-secondary" style={{ fontSize: '0.75rem' }}>Paid</p>
                                  <p style={{ fontWeight: '600', fontSize: '0.95rem', color: '#22c55e' }}>৳{Number(bill.paidAmount || 0).toFixed(0)}</p>
                                </div>
                                <div>
                                  <p className="text-secondary" style={{ fontSize: '0.75rem' }}>Due</p>
                                  <p style={{ fontWeight: '700', fontSize: '1.05rem', color: '#ef4444' }}>৳{due.toFixed(0)}</p>
                                </div>
                              </div>

                              {auth?.isAdmin && (
                                bulkMode && selected.has(bill.id) ? (
                                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <label className="text-secondary" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Collect Amount:</label>
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
                                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                      onClick={() => openPayModal(bill)}
                                      className="btn-primary"
                                      style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                                    >
                                      💰 Collect Payment
                                    </button>
                                    <button
                                      onClick={() => handlePrintBillingInvoice(bill.id)}
                                      className="btn-secondary"
                                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                    >
                                      🖨️ Print Invoice
                                    </button>
                                    <button
                                      onClick={() => handleDownloadBillingInvoice(bill.id)}
                                      className="btn-secondary"
                                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                    >
                                      📥 Download Invoice
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* INVOICE-WISE VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bulkMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
                  <input type="checkbox" checked={selected.size === filteredBills.length} onChange={selectAll} style={{ width: '18px', height: '18px', accentColor: 'var(--accent-1)' }} />
                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Select All Invoices</span>
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
                            <h4 style={{ fontSize: '1.1rem', marginBottom: '2px', fontWeight: '700' }}>
                              👤 Client: <span className="gradient-text">{bill.customerName}</span>
                            </h4>
                            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
                              Invoice #{bill.id} • {bill.createdAt?.split('T')[0]}
                            </p>
                          </div>
                          <div>
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

                        {auth?.isAdmin && (
                          bulkMode && selected.has(bill.id) ? (
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
                            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => openPayModal(bill)}
                                className="btn-primary"
                                style={{ padding: '8px 20px', fontSize: '0.9rem' }}
                              >
                                💰 Collect Payment
                              </button>
                              <button
                                onClick={() => handlePrintBillingInvoice(bill.id)}
                                className="btn-secondary"
                                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                              >
                                🖨️ Print Invoice
                              </button>
                              <button
                                onClick={() => handleDownloadBillingInvoice(bill.id)}
                                className="btn-secondary"
                                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                              >
                                📥 Download Invoice
                              </button>
                            </div>
                          )
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
                    <th style={thStyle}>Client Name</th>
                    <th style={thStyle}>Invoice #</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(p => (
                    <tr key={p.id} className="glass-card" style={{ marginBottom: '4px' }}>
                      <td style={tdStyle}>{p.paymentDate?.split('T')[0]}</td>
                      <td style={{ ...tdStyle, fontWeight: '700' }}>👤 {p.customerName}</td>
                      <td style={tdStyle}>Invoice #{p.orderId}</td>
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
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>💰 Collect Payment</h3>
            <p style={{ marginBottom: '4px', fontSize: '1.05rem', fontWeight: '700' }}>👤 Client: {payModal.customerName}</p>
            <p className="text-secondary" style={{ marginBottom: '12px', fontSize: '0.85rem' }}>Invoice #{payModal.id}</p>

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
