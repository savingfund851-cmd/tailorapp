import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';

interface ProductCardProps {
  product: { id: number; name: string; price: number; stock: number };
  onAddToCart: (id: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const auth = useContext(AuthContext);
  const lang = auth?.lang || 'en';
  const t = useTranslation(lang);

  return (
    <div className="glass-card product-card" id={`product-card-${product.id}`}>
      <h3 className="product-title">{product.name}</h3>
      <p className="product-price">৳{product.price}</p>
      <p className="product-stock">{t.stock}: {product.stock}</p>
      <button 
        className="btn-primary add-to-cart-btn" 
        onClick={() => onAddToCart(product.id)}
        disabled={product.stock === 0}
        id={`add-to-cart-${product.id}`}
      >
        {t.addToCart}
      </button>
    </div>
  );
};
