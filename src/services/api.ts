const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(method: string, path: string, body?: any, token?: string) {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }
    throw new Error(`Request failed: ${res.status}`);
  }

  // PDF download — return blob
  if (contentType.includes('application/pdf')) {
    return res.blob();
  }

  return res.json();
}

export const apiGet = (path: string, token?: string) => request('GET', path, undefined, token);
export const apiPost = (path: string, body: any, token?: string) => request('POST', path, body, token);
export const apiPut = (path: string, body: any, token?: string) => request('PUT', path, body, token);

// Auth
export const loginApi = (username: string, password: string) =>
  apiPost('/login', { username, password });

export const registerApi = (username: string, password: string) =>
  apiPost('/register', { username, password });

// Inventory
export const getInventory = (token?: string) => apiGet('/inventory', token);
export const addInventory = (payload: { name: string; unit: string; stock: number }, token: string) => 
  apiPost('/inventory', payload, token);

// Products
export const getProducts = (token?: string) => apiGet('/products', token);
export const createProduct = (payload: any, token: string) => apiPost('/products', payload, token);
export const deleteProduct = (id: number, token: string) => request('DELETE', `/products/${id}`, undefined, token);

// Orders
export const createCustomOrder = (payload: any, token: string) =>
  apiPost('/orders/custom', payload, token);

export const getOrders = (token: string) => apiGet('/orders', token);

export const acceptOrder = (orderId: number, token: string) => apiPost(`/orders/${orderId}/accept`, {}, token);
export const rejectOrder = (orderId: number, token: string) => apiPost(`/orders/${orderId}/reject`, {}, token);

export const advanceStep = (orderId: number, step: string, token: string) =>
  apiPut(`/orders/${orderId}/step`, { step }, token);

// Invoice (returns PDF blob)
export const getInvoicePdf = (orderId: number, token: string) =>
  apiGet(`/orders/${orderId}/invoice`, token);

// Billing
export const getBilling = (token: string) => apiGet('/billing', token);
export const collectPayment = (orderId: number, amount: number, note: string, token: string) =>
  apiPost(`/billing/${orderId}/pay`, { amount, note }, token);
export const bulkCollectPayment = (payments: { orderId: number; amount: number; note?: string }[], token: string) =>
  apiPost('/billing/bulk-pay', { payments }, token);
export const getPaymentHistory = (token: string) => apiGet('/billing/history', token);

// ================== CLIENTS ==================
export const getClients = (token: string) => apiGet('/clients', token);
export const createClient = (data: { name: string; phone?: string; address?: string; userId?: number }, token: string) =>
  apiPost('/clients', data, token);
export const updateClient = (id: number, data: { name: string; phone?: string; address?: string }, token: string) =>
  apiPut(`/clients/${id}`, data, token);
