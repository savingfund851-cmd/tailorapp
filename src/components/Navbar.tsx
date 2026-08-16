import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';

export const Navbar = () => {
  const auth = useContext(AuthContext);
  if (!auth) return null;
  const t = useTranslation(auth.lang);

  return (
    <nav className="glass sticky-nav" id="main-navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo" id="nav-logo">
          ✂️ {t.appName}
        </Link>
        <div className="nav-links">
          <Link to="/" className="nav-link" id="nav-home">{t.home}</Link>
          {auth.isAuthenticated && (
            <>
              {auth.hasPermission('products') && <Link to="/products" className="nav-link" id="nav-products">Products</Link>}
              {auth.hasPermission('createOrder') && <Link to="/create-order" className="nav-link" id="nav-create-order">+ New Order</Link>}
              {auth.hasPermission('orders') && <Link to="/orders" className="nav-link" id="nav-orders">{auth.isAdmin || auth.user?.userType === 'user' ? t.orders : 'My Orders'}</Link>}
              {auth.hasPermission('billing') && <Link to="/billing" className="nav-link" id="nav-billing">{auth.isAdmin || auth.user?.userType === 'user' ? '💰 Billing' : 'My Billing'}</Link>}
              {auth.isAdmin && <Link to="/users" className="nav-link" id="nav-users">👥 Users</Link>}
              {auth.hasPermission('inventory') && <Link to="/inventory" className="nav-link" id="nav-inventory">Inventory</Link>}
            </>
          )}
        </div>
        <div className="nav-actions">
          <button className="btn-lang" onClick={auth.toggleLang} id="btn-toggle-lang">
            {auth.lang === 'en' ? 'বাং' : 'EN'}
          </button>
          {auth.isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="text-secondary" style={{ fontSize: '0.85rem' }}>👤 {auth.user?.username} ({auth.isAdmin ? 'Admin' : auth.user?.userType})</span>
              <Link to="/change-password" title="Change Password" style={{ fontSize: '1.2rem', cursor: 'pointer' }}>⚙️</Link>
              <button className="btn-primary" onClick={auth.logout} id="btn-logout" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>{t.logout}</button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary" id="nav-login" style={{ padding: '8px 16px' }}>{t.login}</Link>
          )}
        </div>
      </div>
    </nav>
  );
};
