import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getExpenses, addExpense, deleteExpense, getAccountingSummary, getAccountingReportPdf, getExpenseCategories, addExpenseCategory, updateExpenseCategory, deleteExpenseCategory } from '../services/api';

export const AccountingPage = () => {
  const auth = useContext(AuthContext);
  const [tab, setTab] = useState<'overview' | 'expenses' | 'income' | 'categories'>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Category management state
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const fetchData = async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const [s, e, c] = await Promise.all([
        getAccountingSummary(auth.token),
        getExpenses(auth.token),
        getExpenseCategories(auth.token)
      ]);
      setSummary(s); setExpenses(e); setCategories(c);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [auth?.token]);

  const handleAddExpense = async () => {
    if (!auth?.token || !formCategory || !formAmount || Number(formAmount) <= 0) {
      alert('Please fill in category, amount, and date'); return;
    }
    setFormLoading(true);
    try {
      const result = await addExpense({ category: formCategory, amount: Number(formAmount), note: formNote, expenseDate: formDate }, auth.token);
      showToast(result.message || 'Expense added!');
      setFormCategory(''); setFormAmount(''); setFormNote('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setShowForm(false); await fetchData();
    } catch (err: any) { alert(err.message || 'Failed'); } finally { setFormLoading(false); }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!auth?.token || !window.confirm('Delete this expense?')) return;
    try { await deleteExpense(id, auth.token); showToast('Deleted'); await fetchData(); } catch { alert('Failed'); }
  };

  // Category Management Functions
  const handleAddCat = async () => {
    if (!auth?.token || !newCatName.trim()) return;
    try {
      await addExpenseCategory(newCatName.trim(), auth.token);
      setNewCatName('');
      showToast('Category added!');
      await fetchData();
    } catch { alert('Failed to add category'); }
  };

  const handleUpdateCat = async () => {
    if (!auth?.token || !editingCatId || !editingCatName.trim()) return;
    try {
      await updateExpenseCategory(editingCatId, editingCatName.trim(), auth.token);
      setEditingCatId(null); setEditingCatName('');
      showToast('Category updated!');
      await fetchData();
    } catch { alert('Failed to update category'); }
  };

  const handleDeleteCat = async (id: number) => {
    if (!auth?.token || !window.confirm('Delete this category?')) return;
    try {
      await deleteExpenseCategory(id, auth.token);
      showToast('Category deleted!');
      await fetchData();
    } catch { alert('Failed to delete category'); }
  };

  const filteredExpenses = useMemo(() => expenses.filter(e => {
    if (filterCategory && e.category !== filterCategory) return false;
    const d = e.expenseDate?.split('T')[0] || '';
    if (filterDateFrom && d < filterDateFrom) return false;
    if (filterDateTo && d > filterDateTo) return false;
    return true;
  }), [expenses, filterCategory, filterDateFrom, filterDateTo]);

  const filteredTotal = useMemo(() => filteredExpenses.reduce((s, e) => s + Number(e.amount), 0), [filteredExpenses]);

  const allCategoryNames = useMemo(() => categories.map(c => c.name).sort(), [categories]);

  if (loading) return <div className="page-container"><p className="text-secondary">Loading accounting data...</p></div>;

  const handlePrintReport = async () => {
    if (!auth?.token) return;
    try {
      const blob = await getAccountingReportPdf(auth.token);
      const url = URL.createObjectURL(blob as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      alert('Failed to generate report');
    }
  };

  const profitColor = summary?.netProfit >= 0 ? '#22c55e' : '#ef4444';
  const profitIcon = summary?.netProfit >= 0 ? '📈' : '📉';

  return (
    <div className="page-container">
      {toast && <div className="toast">{toast}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="page-title" style={{ margin: 0 }}>📊 Accounting</h2>
        <button className="btn-primary" onClick={handlePrintReport} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '10px 20px' }}>
          🖨️ Print Report
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '3px solid #22c55e' }}>
          <p className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '6px', letterSpacing: '1px', textTransform: 'uppercase' }}>Total Income</p>
          <p style={{ fontSize: '2rem', fontWeight: '800', color: '#22c55e' }}>৳{(summary?.totalIncome || 0).toLocaleString()}</p>
          <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '4px' }}>From client payments</p>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: '3px solid #ef4444' }}>
          <p className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '6px', letterSpacing: '1px', textTransform: 'uppercase' }}>Total Expenses</p>
          <p style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444' }}>৳{(summary?.totalExpenses || 0).toLocaleString()}</p>
          <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '4px' }}>{expenses.length} entries</p>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: `3px solid ${profitColor}` }}>
          <p className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '6px', letterSpacing: '1px', textTransform: 'uppercase' }}>{summary?.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</p>
          <p style={{ fontSize: '2rem', fontWeight: '800', color: profitColor }}>{profitIcon} ৳{Math.abs(summary?.netProfit || 0).toLocaleString()}</p>
          <p className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '4px' }}>Income - Expenses</p>
        </div>
      </div>

      {/* Tab Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['overview', 'expenses', 'income', 'categories'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="btn-secondary" style={{
            background: tab === t ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'rgba(0,0,0,0.3)',
            color: tab === t ? '#0a0e1a' : 'var(--text-secondary)',
            border: tab === t ? 'none' : '1px solid var(--glass-border)',
            fontWeight: tab === t ? '700' : '500', padding: '10px 20px', textTransform: 'capitalize'
          }}>
            {t === 'overview' ? '📊 Overview' : t === 'expenses' ? '💸 Expenses' : t === 'income' ? '💰 Income' : '🏷️ Categories'}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <>
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#fff' }}>💸 Expense by Category</h3>
            {summary?.expenseByCategory?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {summary.expenseByCategory.map((cat: any) => {
                  const pct = summary.totalExpenses > 0 ? (Number(cat.total) / summary.totalExpenses * 100) : 0;
                  return (
                    <div key={cat.category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{cat.category}</span>
                        <span style={{ fontSize: '0.85rem' }}>
                          <span style={{ color: '#ef4444', fontWeight: '700' }}>৳{Number(cat.total).toLocaleString()}</span>
                          <span className="text-secondary" style={{ marginLeft: '8px', fontSize: '0.75rem' }}>({cat.count} entries · {pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #f97316)', borderRadius: '6px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (<p className="text-secondary">No expenses recorded yet</p>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#22c55e' }}>💰 Monthly Income</h3>
              {summary?.monthlyIncome?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {summary.monthlyIncome.map((m: any) => (
                    <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{m.month}</span>
                      <span style={{ fontWeight: '700', color: '#22c55e' }}>৳{Number(m.total).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (<p className="text-secondary">No income data yet</p>)}
            </div>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#ef4444' }}>💸 Monthly Expenses</h3>
              {summary?.monthlyExpenses?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {summary.monthlyExpenses.map((m: any) => (
                    <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{m.month}</span>
                      <span style={{ fontWeight: '700', color: '#ef4444' }}>৳{Number(m.total).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (<p className="text-secondary">No expense data yet</p>)}
            </div>
          </div>
        </>
      )}

      {/* EXPENSES TAB */}
      {tab === 'expenses' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              {showForm ? '✕ Cancel' : '+ Add Expense'}
            </button>
          </div>

          {showForm && (
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '20px', borderLeft: '4px solid #ef4444' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📝 New Expense</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Category *</label>
                  <select className="glass-input" value={formCategory} onChange={e => setFormCategory(e.target.value)} style={{ width: '100%' }}>
                    <option value="">Select Category...</option>
                    {allCategoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" className="glass-input" placeholder="Or type custom category..." value={formCategory} onChange={e => setFormCategory(e.target.value)} style={{ marginTop: '6px', width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Amount (৳) *</label>
                  <input type="number" className="glass-input" placeholder="0" value={formAmount} onChange={e => setFormAmount(e.target.value)} min="1" style={{ width: '100%', fontSize: '1.1rem', fontWeight: '700' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Date *</label>
                  <input type="date" className="glass-input" value={formDate} onChange={e => setFormDate(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Note (optional)</label>
                  <input type="text" className="glass-input" placeholder="e.g. Monthly rent payment" value={formNote} onChange={e => setFormNote(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>
              <button className="btn-primary" onClick={handleAddExpense} disabled={formLoading} style={{ marginTop: '16px', padding: '12px 32px', fontSize: '1rem' }}>
                {formLoading ? 'Saving...' : '✅ Save Expense'}
              </button>
            </div>
          )}

          <div className="glass-card" style={{ padding: '1rem', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Category</label>
              <select className="glass-input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: '8px' }}>
                <option value="">All Categories</option>
                {allCategoryNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>From</label>
              <input type="date" className="glass-input" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>To</label>
              <input type="date" className="glass-input" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ padding: '8px' }} />
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Showing: <strong style={{ color: '#ef4444' }}>{filteredExpenses.length}</strong> entries</p>
              <p style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ef4444' }}>Total: ৳{filteredTotal.toLocaleString()}</p>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="glass-card text-center" style={{ padding: '3rem' }}>
              <p className="text-secondary" style={{ fontSize: '1.1rem' }}>No expenses found</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                <thead><tr>
                  <th style={thStyle}>Date</th><th style={thStyle}>Category</th><th style={thStyle}>Amount</th><th style={thStyle}>Note</th><th style={thStyle}>Action</th>
                </tr></thead>
                <tbody>
                  {filteredExpenses.map(exp => (
                    <tr key={exp.id} className="glass-card">
                      <td style={tdStyle}>{exp.expenseDate?.split('T')[0]}</td>
                      <td style={tdStyle}><span style={{ padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: '600', background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>{exp.category}</span></td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: '#ef4444', fontSize: '1rem' }}>৳{Number(exp.amount).toLocaleString()}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{exp.note || '—'}</td>
                      <td style={tdStyle}>
                        <button onClick={() => handleDeleteExpense(exp.id)} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>🗑️ Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* INCOME TAB */}
      {tab === 'income' && (
        <>
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '16px', borderLeft: '4px solid #22c55e' }}>
            <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>💡 Income is automatically calculated from all payment collections in the Billing section.</p>
            <p style={{ fontSize: '1.6rem', fontWeight: '800', color: '#22c55e' }}>Total Income: ৳{(summary?.totalIncome || 0).toLocaleString()}</p>
          </div>

          {summary?.monthlyIncome?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {summary.monthlyIncome.map((m: any) => {
                const matchingExpense = summary.monthlyExpenses?.find((e: any) => e.month === m.month);
                const monthExpense = matchingExpense ? Number(matchingExpense.total) : 0;
                const monthProfit = Number(m.total) - monthExpense;
                return (
                  <div key={m.month} className="glass-card" style={{ padding: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '700' }}>📅 {m.month}</h4>
                      <div style={{ display: 'flex', gap: '24px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <p className="text-secondary" style={{ fontSize: '0.7rem' }}>Income</p>
                          <p style={{ fontWeight: '700', color: '#22c55e', fontSize: '1rem' }}>৳{Number(m.total).toLocaleString()}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p className="text-secondary" style={{ fontSize: '0.7rem' }}>Expense</p>
                          <p style={{ fontWeight: '700', color: '#ef4444', fontSize: '1rem' }}>৳{monthExpense.toLocaleString()}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p className="text-secondary" style={{ fontSize: '0.7rem' }}>{monthProfit >= 0 ? 'Profit' : 'Loss'}</p>
                          <p style={{ fontWeight: '800', color: monthProfit >= 0 ? '#22c55e' : '#ef4444', fontSize: '1.1rem' }}>
                            {monthProfit >= 0 ? '📈' : '📉'} ৳{Math.abs(monthProfit).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card text-center" style={{ padding: '3rem' }}>
              <p className="text-secondary" style={{ fontSize: '1.1rem' }}>No income recorded yet</p>
            </div>
          )}
        </>
      )}

      {/* CATEGORIES TAB */}
      {tab === 'categories' && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>🏷️ Manage Expense Categories</h3>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>Add, edit, or delete categories used for tracking expenses. Updating a category name will automatically update all existing expenses that use it.</p>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input 
              type="text" 
              className="glass-input" 
              placeholder="New Category Name..." 
              value={newCatName} 
              onChange={e => setNewCatName(e.target.value)} 
              style={{ flex: 1, maxWidth: '300px' }}
            />
            <button className="btn-primary" onClick={handleAddCat}>+ Add Category</button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px', maxWidth: '600px' }}>
            <thead>
              <tr>
                <th style={thStyle}>Category Name</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id} className="glass-card">
                  <td style={tdStyle}>
                    {editingCatId === c.id ? (
                      <input 
                        type="text" 
                        className="glass-input" 
                        value={editingCatName} 
                        onChange={e => setEditingCatName(e.target.value)}
                        style={{ padding: '6px', fontSize: '0.9rem', width: '100%' }}
                      />
                    ) : (
                      <span style={{ fontWeight: '600' }}>{c.name}</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {editingCatId === c.id ? (
                      <>
                        <button className="btn-primary" onClick={handleUpdateCat} style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: '6px' }}>Save</button>
                        <button className="btn-secondary" onClick={() => setEditingCatId(null)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }} 
                          className="btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: '6px' }}
                        >✏️ Edit</button>
                        <button 
                          onClick={() => handleDeleteCat(c.id)} 
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >🗑️</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: '0.8rem',
  fontWeight: '600', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)',
};

const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: '0.9rem' };
