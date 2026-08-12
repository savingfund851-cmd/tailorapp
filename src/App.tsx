import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { CreateOrderPage } from './pages/CreateOrderPage';
import { OrdersPage } from './pages/OrdersPage';
import { InvoicePage } from './pages/InvoicePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProductsPage } from './pages/ProductsPage';
import { BillingPage } from './pages/BillingPage';
import './index.css';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const auth = useContext(AuthContext);
  if (!auth?.token) return <Navigate to="/login" />;
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-order"
            element={
              <ProtectedRoute>
                <CreateOrderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id/invoice"
            element={
              <ProtectedRoute>
                <InvoicePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <BillingPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
