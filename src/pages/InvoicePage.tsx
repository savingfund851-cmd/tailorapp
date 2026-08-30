import React, { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { getInvoicePdf, getOrders } from '../services/api';

export const InvoicePage = () => {
  const { id } = useParams<{ id: string }>();
  const auth = useContext(AuthContext);
  const t = useTranslation(auth?.lang || 'en');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!auth?.token || !id) return;
      try {
        const orders = await getOrders(auth.token);
        const found = orders.find((o: any) => o.id === Number(id));
        if (found) setOrder(found);
      } catch (err) {
        console.error('Failed to load order', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, auth?.token]);

  const handleDownloadPdf = async () => {
    if (!auth?.token || !id) return;
    try {
      const blob = await getInvoicePdf(Number(id), auth.token);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TechPack-ORD${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download PDF');
    }
  };

  const handlePrintTechPack = async () => {
    if (!auth?.token || !id) return;
    try {
      const blob = await getInvoicePdf(Number(id), auth.token);
      const url = URL.createObjectURL(blob as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      alert('Failed to open PDF for printing');
    }
  };

  if (loading) return <div className="page-container"><p className="text-secondary">Loading...</p></div>;
  if (!order) return <div className="page-container"><p className="error-text">Order not found</p></div>;

  return (
    <div className="page-container invoice-page">
      <div className="invoice-paper glass">
        <div className="invoice-header">
          <div>
            <h2 style={{ fontSize: '1.8rem', background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Tech Pack / Invoice
            </h2>
            <p className="text-secondary" style={{ marginTop: '4px' }}>TailorApp</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p><strong>Order #:</strong> ORD-{String(order.id).padStart(4, '0')}</p>
            <p><strong>Date:</strong> {order.createdAt?.split('T')[0]}</p>
          </div>
        </div>

        <div className="invoice-customer mt-4">
          <p><strong>{t.customer}:</strong> {order.customerName}</p>
          <p className="text-secondary"><strong>Status:</strong> {order.status}</p>
        </div>

        <table className="invoice-table mt-6">
          <thead>
            <tr>
              <th>{t.productName}</th>
              <th>Color / Size</th>
              <th>{t.quantity}</th>
              <th>{t.price}</th>
              <th>{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item: any, i: number) => {
              const qty = item.quantity || 1;
              const rowTotal = Number(item.price) * qty;
              return (
                <tr key={i}>
                  <td>{i + 1}. {item.description}</td>
                  <td>{item.clothColor} / {item.size}</td>
                  <td>{qty}</td>
                  <td>৳{item.price}</td>
                  <td>৳{rowTotal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="invoice-total mt-6 text-right">
          <h3 style={{ fontSize: '1.5rem' }}>{t.total}: ৳{order.total}</h3>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
          <button
            className="btn-primary print-hide"
            onClick={() => window.print()}
            id="btn-print-invoice"
          >
            🖨️ Print Summary
          </button>
          
          <button
            className="btn-secondary print-hide"
            onClick={handlePrintTechPack}
          >
            🖨️ Print Tech Pack
          </button>

          <button
            className="btn-secondary print-hide"
            onClick={handleDownloadPdf}
            id="btn-download-pdf"
          >
            📥 Download Tech Pack (PDF)
          </button>
        </div>
      </div>
    </div>
  );
};
