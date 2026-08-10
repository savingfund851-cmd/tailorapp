import React, { useState, useEffect, useContext } from 'react';
import { ProductCard } from '../components/ProductCard';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { getProducts, createOrder } from '../services/api';

export const CatalogPage = () => {
  const auth = useContext(AuthContext);
  const t = useTranslation(auth?.lang || 'en');
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<{ [id: number]: number }>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProducts();
        setProducts(data);
      } catch (error) {
        console.error("Failed to load products", error);
      }
    };
    loadProducts();
  }, []);

  const handleAddToCart = (id: number) => {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const handlePlaceOrder = async () => {
    if (!auth?.token) return;
    try {
      const items = Object.entries(cart).map(([id, qty]) => ({ productId: Number(id), quantity: qty }));
      // await createOrder(items, auth.token); // Mocked
      setToast(t.orderPlaced);
      setCart({});
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error(error);
    }
  };

  const cartItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    <div className="page-container">
      {toast && <div className="toast glass">{toast}</div>}
      <div className="catalog-layout">
        <div className="products-grid">
          {products.map(p => (
            <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
          ))}
        </div>
        <div className="sidebar glass">
          <h3>Cart Summary</h3>
          <p>Items: {cartItemsCount}</p>
          {auth?.isAuthenticated ? (
            <button 
              className="btn-primary mt-4 w-full" 
              onClick={handlePlaceOrder}
              disabled={cartItemsCount === 0}
              id="btn-place-order"
            >
              {t.placeOrder}
            </button>
          ) : (
            <p className="mt-4 text-secondary">Please login to place an order.</p>
          )}
        </div>
      </div>
    </div>
  );
};
