import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';

export const HomePage = () => {
  const auth = useContext(AuthContext);
  const lang = auth?.lang || 'en';
  const t = useTranslation(lang);

  return (
    <div className="home-container">
      <div className="hero-section glass">
        <div className="hero-badge">✂️ Tailor Master Dashboard</div>
        <h1 className="hero-title">
          <span className="gradient-text">{t.appName}</span>
        </h1>
        <p className="hero-subtitle">
          Premium tailoring management — create orders, track workflow, manage inventory, and generate invoices. All in one place.
        </p>
        <div className="hero-actions">
          {auth?.isAuthenticated ? (
            auth.isAdmin ? (
              <>
                <Link to="/create-order" className="btn-primary" id="home-create-order" style={{ padding: '14px 32px', fontSize: '1.05rem' }}>
                  ✂️ New Custom Order
                </Link>
                <Link to="/orders" className="btn-secondary" id="home-view-orders" style={{ padding: '14px 32px', fontSize: '1.05rem' }}>
                  📋 {t.orders}
                </Link>
                <Link to="/clients" className="btn-secondary" id="home-clients" style={{ padding: '14px 32px', fontSize: '1.05rem' }}>
                  👥 Clients
                </Link>
                <Link to="/inventory" className="btn-secondary" id="home-inventory" style={{ padding: '14px 32px', fontSize: '1.05rem' }}>
                  📦 Inventory
                </Link>
              </>
            ) : (
              <>
                <Link to="/create-order" className="btn-primary" id="home-create-order" style={{ padding: '14px 32px', fontSize: '1.05rem' }}>
                  ✂️ Request Order
                </Link>
                <Link to="/orders" className="btn-secondary" id="home-view-orders" style={{ padding: '14px 32px', fontSize: '1.05rem' }}>
                  📋 My Orders
                </Link>
              </>
            )
          ) : (
            <>
              <Link to="/register" className="btn-primary" id="home-register" style={{ padding: '14px 32px', fontSize: '1.05rem' }}>
                Get Started
              </Link>
              <Link to="/login" className="btn-secondary" id="home-login" style={{ padding: '14px 32px', fontSize: '1.05rem' }}>
                {t.login}
              </Link>
            </>
          )}
        </div>

        {/* Feature cards */}
        <div className="hero-features">
          <div className="feature-card">
            <div className="feature-icon">📐</div>
            <h3>Custom Orders</h3>
            <p>Create orders with precise body measurements, cloth selection & color</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Smart Inventory</h3>
            <p>Auto-deduct raw materials when orders are placed. Real-time stock tracking</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔄</div>
            <h3>Workflow Tracking</h3>
            <p>Cutting → Sewing → Finishing → Delivery — track every step</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🧾</div>
            <h3>PDF Invoices</h3>
            <p>Generate professional PDF invoices for every completed order</p>
          </div>
        </div>
      </div>
      <div className="animated-bg">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
    </div>
  );
};
