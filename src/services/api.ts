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

export const changePassword = (currentPassword: string, newPassword: string, token: string) =>
  apiPut('/change-password', { currentPassword, newPassword }, token);

// Inventory
export const getInventory = (token: string) => apiGet('/inventory', token);
export const updateInventoryStock = (id: number, amount: number, adminPassword: string, token: string) =>
  request('PUT', `/inventory/${id}/stock`, { amount, adminPassword }, token);
export const deleteInventoryItem = (id: number, adminPassword: string, token: string) =>
  request('DELETE', `/inventory/${id}`, { adminPassword }, token);
export const addInventory = (payload: { name: string; unit: string; stock: number }, token: string) => 
  apiPost('/inventory', payload, token);

// Users (Admin only)
export const getUsers = (token: string) => apiGet('/users', token);
export const createUser = (data: { username: string; password?: string; userType: string; name?: string; phone?: string; address?: string; permissions?: any }, token: string) =>
  apiPost('/users', data, token);
export const updateUser = (id: number, data: { name?: string; phone?: string; address?: string; permissions?: any; password?: string; status?: string }, token: string) =>
  apiPut(`/users/${id}`, data, token);
export const deleteUser = (id: number, token: string) => request('DELETE', `/users/${id}`, undefined, token);

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

export const updateOrderItem = (orderId: number, itemId: number, payload: any, token: string) =>
  apiPut(`/orders/${orderId}/items/${itemId}`, payload, token);
export const updateOrderItemsOrder = (orderId: number, itemIds: number[], token: string) =>
  apiPut(`/orders/${orderId}/items-order`, { itemIds }, token);
export const deleteOrderItem = (orderId: number, itemId: number, token: string) =>
  request('DELETE', `/orders/${orderId}/items/${itemId}`, undefined, token);

export const advanceStep = (orderId: number, step: string, token: string) =>
  apiPut(`/orders/${orderId}/step`, { step }, token);
export const advanceItemStep = (orderId: number, itemId: number, token: string) =>
  apiPut(`/orders/${orderId}/items/${itemId}/advance`, {}, token);

// Invoice (returns PDF blob)
export const getInvoicePdf = (orderId: number, token: string) =>
  apiGet(`/orders/${orderId}/invoice`, token);

// Billing
export const getBilling = (token: string) => apiGet('/billing', token);
export const getBillingInvoicePdf = (orderId: number, token: string) =>
  apiGet(`/billing/${orderId}/invoice`, token);
export const getBulkBillingInvoicePdf = (orderIds: number[], token: string) =>
  apiGet(`/billing/bulk-invoice?orderIds=${orderIds.join(',')}`, token);
export const collectPayment = (orderId: number, amount: number, note: string, token: string) =>
  apiPost(`/billing/${orderId}/pay`, { amount, note }, token);
export const bulkCollectPayment = (payments: { orderId: number; amount: number; note?: string }[], token: string) =>
  apiPost('/billing/bulk-pay', { payments }, token);
export const getPaymentHistory = (token: string) => apiGet('/billing/history', token);

// ================== USERS & CLIENTS ==================
// Legacy for order creation dropdown
export const getClients = (token: string) => apiGet('/clients', token);

// ================== ACCOUNTING / EXPENSES ==================
export const getExpenses = (token: string) => apiGet('/expenses', token);
export const addExpense = (payload: { category: string; amount: number; note: string; expenseDate: string }, token: string) =>
  apiPost('/expenses', payload, token);
export const deleteExpense = (id: number, token: string) => request('DELETE', `/expenses/${id}`, undefined, token);
export const getAccountingSummary = (token: string) => apiGet('/accounting/summary', token);
export const getAccountingReportPdf = (token: string) => apiGet('/accounting/report', token);
export const getExpenseCategories = (token: string) => apiGet('/expenses/categories', token);
export const addExpenseCategory = (name: string, token: string) => apiPost('/expenses/categories', { name }, token);
export const updateExpenseCategory = (id: number, name: string, token: string) => request('PUT', `/expenses/categories/${id}`, { name }, token);
export const deleteExpenseCategory = (id: number, token: string) => request('DELETE', `/expenses/categories/${id}`, undefined, token);
