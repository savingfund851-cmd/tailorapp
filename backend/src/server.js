require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const path = require('path');

// JWT secret
const JWT_SECRET = 'tailorapp-secret-key-2024';

// Database helpers
const { pool, init, run, get, all, camelMap } = require('./db');

// Initialize SQLite schema and seed data
init();

const app = express();
app.use(cors());
app.use(express.json());

// Middleware to verify JWT
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Simple status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const materialCount = await get('SELECT COUNT(*) AS cnt FROM materials');
    const userCount = await get('SELECT COUNT(*) AS cnt FROM users');
    res.json({ status: 'ok', materials: materialCount.cnt, users: userCount.cnt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
// Middleware to verify JWT and check if Admin
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'master') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}

// Middleware to check specific permission
function requirePermission(perm) {
  return function (req, res, next) {
    if (req.user && req.user.role === 'master') {
      return next(); // master has all permissions
    }
    const perms = req.user?.permissions || {};
    if (perms[perm]) {
      return next();
    }
    res.status(403).json({ error: `Permission denied. Requires: ${perm}` });
  };
}

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await get('SELECT id, username, role, userType, permissions FROM users WHERE username = ? AND password = ?', [username, password]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    let perms = {};
    try { perms = JSON.parse(user.permissions || '{}'); } catch(e) {}
    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role, userType: user.userType, permissions: perms }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, userType: user.userType, permissions: perms } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change own password
app.put('/api/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  try {
    const user = await get('SELECT id FROM users WHERE id = ? AND password = ?', [req.user.userId, currentPassword]);
    if (!user) return res.status(401).json({ error: 'Current password is incorrect' });
    await run('UPDATE users SET password = ? WHERE id = ?', [newPassword, req.user.userId]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Products API ---
app.get('/api/products', authenticate, async (req, res) => {
  try {
    const products = await all('SELECT * FROM products');
    const detailed = await Promise.all(products.map(async (prod) => {
      const materials = await all(
        'SELECT pm.quantity, m.id as materialId, m.name, m.unit FROM product_materials pm JOIN materials m ON pm.materialId = m.id WHERE pm.productId = ?',
        [prod.id]
      );
      return { ...prod, materials };
    }));
    res.json(detailed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products', authenticate, requirePermission('products'), async (req, res) => {
  const { name, category, basePrice, defaultMeasurements, materials, colors, sizeGroup, sizes, remarks } = req.body;
  try {
    const result = await run(
      'INSERT INTO products (name, category, basePrice, defaultMeasurements, colors, sizeGroup, sizes, remarks, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [name, category, basePrice, defaultMeasurements, colors || '', sizeGroup || '', sizes || '', remarks || '', new Date().toISOString()]
    );
    const productId = result.lastID;
    if (materials && Array.isArray(materials)) {
      for (const mat of materials) {
        await run(
          'INSERT INTO product_materials (productId, materialId, quantity) VALUES (?, ?, ?)',
          [productId, mat.materialId, mat.quantity]
        );
      }
    }
    res.status(201).json({ message: 'Product created', id: productId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/products/:id', authenticate, requirePermission('products'), async (req, res) => {
  const productId = parseInt(req.params.id);
  try {
    await run('DELETE FROM product_materials WHERE productId = ?', [productId]);
    await run('DELETE FROM products WHERE id = ?', [productId]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
// --------------------

// --- Users API (Admin manages all users) ---
app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await all('SELECT u.id, u.username, u.role, u.userType, u.permissions, c.id as clientId, c.name, c.phone, c.address, c.createdAt FROM users u LEFT JOIN clients c ON c.userId = u.id WHERE u.role != ? ORDER BY u.id ASC', ['master']);
    // Parse permissions JSON
    const result = users.map(u => {
      let perms = {};
      try { perms = JSON.parse(u.permissions || '{}'); } catch(e) {}
      return { ...u, permissions: perms };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  const { username, password, userType, name, phone, address, permissions } = req.body;
  if (!username || !password || !userType) return res.status(400).json({ error: 'Username, password and user type are required' });
  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    // Default permissions for 'user' type: only createOrder
    let perms = permissions || {};
    if (userType === 'user' && !permissions) {
      perms = { orders: false, billing: false, inventory: false, products: false, createOrder: true };
    } else if (userType === 'client') {
      perms = { orders: true, billing: true, inventory: false, products: false, createOrder: true };
    }

    const permsStr = JSON.stringify(perms);
    const result = await run(
      'INSERT INTO users (username, password, role, userType, permissions) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [username, password, 'client', userType, permsStr]
    );
    const userId = result.lastID;

    // Create client profile (for both types — links user to orders)
    await run(
      'INSERT INTO clients (userId, name, phone, address, createdAt) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [userId, name || username, phone || '', address || '', new Date().toISOString()]
    );

    res.status(201).json({ message: 'User created', id: userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, phone, address, permissions, password } = req.body;
  const userId = parseInt(req.params.id);
  try {
    // Update client profile
    if (name !== undefined) {
      await run('UPDATE clients SET name = ?, phone = ?, address = ? WHERE userId = ?', [name, phone || '', address || '', userId]);
    }
    // Update permissions
    if (permissions !== undefined) {
      const permsStr = JSON.stringify(permissions);
      await run('UPDATE users SET permissions = ? WHERE id = ?', [permsStr, userId]);
    }
    // Admin can reset password
    if (password) {
      await run('UPDATE users SET password = ? WHERE id = ?', [password, userId]);
    }
    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Keep /api/clients for backward compat (order creation dropdown)
app.get('/api/clients', authenticate, async (req, res) => {
  try {
    const clients = await all('SELECT * FROM clients ORDER BY createdAt DESC');
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
// --------------------
app.get('/api/inventory', authenticate, async (req, res) => {
  try {
    const materials = await all('SELECT * FROM materials');
    res.json(materials);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add or Update Stock Entry
app.post('/api/inventory', authenticate, requirePermission('inventory'), async (req, res) => {
  const { name, unit, stock } = req.body;
  if (!name || !unit || stock === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const cleanName = name.trim();
  const cleanUnit = unit.trim();

  try {
    // Check if material already exists (case insensitive)
    const existing = await get('SELECT id, stock FROM materials WHERE LOWER(name) = LOWER(?) AND LOWER(unit) = LOWER(?)', [cleanName, cleanUnit]);
    
    if (existing) {
      // Update existing stock
      await run('UPDATE materials SET stock = stock + ? WHERE id = ?', [Number(stock), existing.id]);
      res.json({ message: 'Stock updated successfully', id: existing.id });
    } else {
      // Add new material
      const result = await run('INSERT INTO materials (name, unit, stock) VALUES (?, ?, ?) RETURNING id', [cleanName, cleanUnit, Number(stock)]);
      res.status(201).json({ message: 'New material added successfully', id: result.lastID });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper to validate and deduct stock
async function validateAndDeductStock(required) {
  // Validate stock
  for (const [materialId, qty] of Object.entries(required)) {
    const material = await get('SELECT id, name, stock FROM materials WHERE id = ?', [materialId]);
    if (!material || material.stock < qty) {
      throw new Error(`Insufficient stock for ${material ? material.name : 'Unknown'}. Needed: ${qty}, Available: ${material ? material.stock : 0}`);
    }
  }
  // Deduct stock
  for (const [materialId, qty] of Object.entries(required)) {
    await run('UPDATE materials SET stock = stock - ? WHERE id = ?', [qty, materialId]);
  }
}

// Create custom order
app.post('/api/orders/custom', authenticate, async (req, res) => {
  const { customerName, clientId, items } = req.body; // clientId can be provided
  if (!customerName || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Aggregate required materials
  const requiredMaterials = {};
  for (const item of items) {
    for (const mat of item.materials) {
      const id = mat.materialId;
      requiredMaterials[id] = (requiredMaterials[id] || 0) + Number(mat.quantity);
    }
  }

  // We will NOT deduct stock here. Order is created as 'Pending Acceptance'
  // Calculate total
  let total = 0;
  for (const item of items) total += Number(item.price) * Number(item.quantity || 1);

  let finalClientId = clientId;
  if (req.user.role === 'client' && !finalClientId) {
      // Find client record for this user
      const clientRecord = await get('SELECT id FROM clients WHERE userId = ?', [req.user.userId]);
      if (clientRecord) finalClientId = clientRecord.id;
  }

  // Insert order
  let orderResult;
  try {
    orderResult = await run(
      'INSERT INTO orders (userId, clientId, productId, customerName, total, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [req.user.userId, finalClientId || null, req.body.productId || null, customerName, total, 'Pending Acceptance', new Date().toISOString()]
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create order' });
  }
  const orderId = orderResult.lastID;

  // Insert order items and link materials
  for (const item of items) {
    const itemResult = await run(
      'INSERT INTO order_items (orderId, description, clothColor, size, measurements, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [orderId, item.description, item.clothColor, item.size, item.measurements, item.price, item.quantity || 1]
    );
    const orderItemId = itemResult.lastID;
    // Insert BOM entries
    for (const mat of item.materials) {
      await run(
        'INSERT INTO order_item_materials (orderItemId, materialId, quantity) VALUES (?, ?, ?)',
        [orderItemId, mat.materialId, mat.quantity]
      );
    }
  }

  // Insert workflow steps
  const steps = ['Cutting', 'Sewing', 'Finishing', 'Quality Check', 'Final Delivery'];
  for (const stepName of steps) {
    await run('INSERT INTO workflow_steps (orderId, step) VALUES (?, ?)', [orderId, stepName]);
  }

  res.status(201).json({ orderId, message: 'Custom order created successfully. Pending Acceptance.' });
});

// Get orders (Admin sees all, Client sees own)
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'master') {
       orders = await all('SELECT * FROM orders ORDER BY createdAt DESC');
    } else {
       const clientRecord = await get('SELECT id FROM clients WHERE userId = ?', [req.user.userId]);
       if (clientRecord) {
           orders = await all('SELECT * FROM orders WHERE clientId = ? ORDER BY createdAt DESC', [clientRecord.id]);
       } else {
           orders = await all('SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC', [req.user.userId]);
       }
    }

    if (orders.length === 0) return res.json([]);

    // Batch: fetch ALL items, workflows, and materials in just 3 queries
    const orderIds = orders.map(o => o.id);
    const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');

    const [allItems, allWorkflow] = await Promise.all([
      pool.query(`SELECT * FROM order_items WHERE "orderid" IN (${placeholders}) ORDER BY "itemindex" ASC, description ASC`, orderIds),
      pool.query(`SELECT * FROM workflow_steps WHERE "orderid" IN (${placeholders})`, orderIds)
    ]);

    const itemRows = allItems.rows.map(r => {
      const mapped = {};
      for (const key in r) { mapped[camelMap[key] || key] = r[key]; }
      return mapped;
    });
    const workflowRows = allWorkflow.rows.map(r => {
      const mapped = {};
      for (const key in r) { mapped[camelMap[key] || key] = r[key]; }
      return mapped;
    });

    // Fetch materials for all items in one query
    const itemIds = itemRows.map(i => i.id);
    let matRows = [];
    if (itemIds.length > 0) {
      const matPlaceholders = itemIds.map((_, i) => `$${i + 1}`).join(',');
      const allMats = await pool.query(
        `SELECT oim."orderitemid", m.name, m.unit, oim.quantity FROM order_item_materials oim JOIN materials m ON oim."materialid" = m.id WHERE oim."orderitemid" IN (${matPlaceholders})`,
        itemIds
      );
      matRows = allMats.rows.map(r => {
        const mapped = {};
        for (const key in r) { mapped[camelMap[key] || key] = r[key]; }
        return mapped;
      });
    }

    // Group by orderId in memory
    const itemsByOrder = {};
    for (const item of itemRows) {
      if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
      itemsByOrder[item.orderId].push(item);
    }
    const matsByItem = {};
    for (const mat of matRows) {
      if (!matsByItem[mat.orderItemId]) matsByItem[mat.orderItemId] = [];
      matsByItem[mat.orderItemId].push(mat);
    }
    const workflowByOrder = {};
    for (const ws of workflowRows) {
      if (!workflowByOrder[ws.orderId]) workflowByOrder[ws.orderId] = [];
      workflowByOrder[ws.orderId].push(ws);
    }

    // Assemble
    const detailed = orders.map(order => {
      const items = (itemsByOrder[order.id] || []).map(item => ({
        ...item,
        materialsUsed: matsByItem[item.id] || []
      }));
      return { ...order, items, workflow: workflowByOrder[order.id] || [] };
    });

    res.json(detailed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Workflow steps in order
const WORKFLOW_STEPS = ['Pending', 'Cutting', 'Sewing', 'Finishing', 'Quality Check', 'Completed'];

// Helper: derive order status from its items' workflow steps
async function deriveOrderStatus(orderId) {
  const items = await all('SELECT workflowStep FROM order_items WHERE orderId = ?', [orderId]);
  if (items.length === 0) return 'Processing';
  const allCompleted = items.every(i => i.workflowStep === 'Completed');
  if (allCompleted) return 'Delivered';
  return 'Processing';
}

// Advance a single item's workflow step
app.put('/api/orders/:orderId/items/:itemId/advance', authenticate, requirePermission('orders'), async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const itemId = parseInt(req.params.itemId);
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const item = await get('SELECT * FROM order_items WHERE id = ? AND orderId = ?', [itemId, orderId]);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const currentIdx = WORKFLOW_STEPS.indexOf(item.workflowStep);
    if (currentIdx === -1 || currentIdx >= WORKFLOW_STEPS.length - 1) {
      return res.status(400).json({ error: 'Item is already completed' });
    }

    const nextStep = WORKFLOW_STEPS[currentIdx + 1];
    await run('UPDATE order_items SET workflowStep = ? WHERE id = ?', [nextStep, itemId]);

    // Derive and update order status
    const newStatus = await deriveOrderStatus(orderId);
    await run('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);

    res.json({ message: `Item advanced to ${nextStep}`, newStep: nextStep, orderStatus: newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy: Advance workflow step (keep for backward compat, but now just no-op or redirect)
app.put('/api/orders/:id/step', authenticate, requirePermission('orders'), async (req, res) => {
  res.status(400).json({ error: 'Use item-level workflow advancement instead' });
});

// Accept order (check stock, deduct, start Cutting)
app.post('/api/orders/:id/accept', authenticate, requirePermission('orders'), async (req, res) => {
  const orderId = parseInt(req.params.id);
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'Pending Acceptance') return res.status(400).json({ error: 'Order is not pending' });

    // Gather required materials from order_items and order_item_materials
    const items = await all('SELECT * FROM order_items WHERE orderId = ? ORDER BY itemIndex ASC, description ASC', [orderId]);
    const requiredMaterials = {};
    for (const item of items) {
      const mats = await all('SELECT materialId, quantity FROM order_item_materials WHERE orderItemId = ?', [item.id]);
      for (const mat of mats) {
        requiredMaterials[mat.materialId] = (requiredMaterials[mat.materialId] || 0) + Number(mat.quantity);
      }
    }

    try {
      await validateAndDeductStock(requiredMaterials);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // Set all items to 'Cutting' step
    await run('UPDATE order_items SET workflowStep = ? WHERE orderId = ?', ['Cutting', orderId]);
    await run('UPDATE orders SET status = ? WHERE id = ?', ['Processing', orderId]);
    res.json({ message: 'Order accepted and stock deducted. Workflow started.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject order
app.post('/api/orders/:id/reject', authenticate, requirePermission('orders'), async (req, res) => {
  const orderId = parseInt(req.params.id);
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'Pending Acceptance') return res.status(400).json({ error: 'Order is not pending' });

    await run('UPDATE orders SET status = ? WHERE id = ?', ['Rejected', orderId]);
    res.json({ message: 'Order rejected.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an order item
app.delete('/api/orders/:orderId/items/:itemId', authenticate, requirePermission('orders'), async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const itemId = parseInt(req.params.itemId);
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // Delete materials for this item first
    await run('DELETE FROM order_item_materials WHERE orderItemId = ?', [itemId]);
    // Delete the item
    await run('DELETE FROM order_items WHERE id = ?', [itemId]);
    
    // Recalculate order total
    const remainingItems = await all('SELECT price, quantity FROM order_items WHERE orderId = ?', [orderId]);
    const newTotal = remainingItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);
    
    await run('UPDATE orders SET total = ? WHERE id = ?', [newTotal, orderId]);
    
    res.json({ message: 'Item deleted', newTotal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update an order item
app.put('/api/orders/:orderId/items/:itemId', authenticate, requirePermission('orders'), async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const itemId = parseInt(req.params.itemId);
  const { description, clothColor, size, price, measurements, quantity } = req.body;
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    await run(
      'UPDATE order_items SET description = ?, clothColor = ?, size = ?, measurements = ?, price = ?, quantity = ? WHERE id = ?',
      [description, clothColor, size, measurements, price, quantity || 1, itemId]
    );
    
    // Recalculate order total
    const allItems = await all('SELECT price, quantity FROM order_items WHERE orderId = ?', [orderId]);
    const newTotal = allItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);
    
    await run('UPDATE orders SET total = ? WHERE id = ?', [newTotal, orderId]);
    
    res.json({ message: 'Item updated', newTotal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update order items sequence (drag and drop)
app.put('/api/orders/:id/items-order', authenticate, requirePermission('orders'), async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { itemIds } = req.body; // Array of item IDs in the new order
  if (!Array.isArray(itemIds)) return res.status(400).json({ error: 'Invalid payload' });
  
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // Update itemIndex for each item
    for (let i = 0; i < itemIds.length; i++) {
      await run('UPDATE order_items SET itemIndex = ? WHERE id = ? AND orderId = ?', [i, itemIds[i], orderId]);
    }
    
    res.json({ message: 'Items order saved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Invoice PDF generation
app.get('/api/orders/:id/invoice', authenticate, async (req, res) => {
  const orderId = parseInt(req.params.id);
  try {
    let order;
    if (req.user.role === 'master') {
      order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    } else {
      const clientRecord = await get('SELECT id FROM clients WHERE userId = ?', [req.user.userId]);
      if (clientRecord) {
        order = await get('SELECT * FROM orders WHERE id = ? AND clientId = ?', [orderId, clientRecord.id]);
      } else {
        order = await get('SELECT * FROM orders WHERE id = ? AND userId = ?', [orderId, req.user.userId]);
      }
    }
    
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = await all('SELECT * FROM order_items WHERE orderId = ? ORDER BY itemIndex ASC, description ASC', [orderId]);

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=TechPack-ORD${orderId}.pdf`,
        'Content-Length': pdfData.length
      });
      res.send(pdfData);
    });

    // Header
    doc.fontSize(20).text('TailorApp Tech Pack', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Order #: ORD-${String(orderId).padStart(4, '0')}`);
    doc.text(`Date: ${order.createdAt.split('T')[0]}`);
    doc.text(`Client: ${order.customerName}`);
    doc.moveDown(0.5);
    
    // Line separator
    doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(1);

    // Items
    items.forEach((item, index) => {
      const qty = item.quantity || 1;
      
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text(`${index + 1}. ${item.description} (QTY: ${qty})`);
      
      doc.font('Helvetica').fontSize(11);
      doc.text(`Color: ${item.clothColor} | Size: ${item.size}`);
      if (item.measurements) {
        doc.text(`Measurements: ${item.measurements.replace(/\n/g, ', ')}`);
      }
      
      doc.moveDown(0.8);

      // Print checklists per unit
      doc.font('Helvetica-Bold').fontSize(11);
      for (let i = 1; i <= qty; i++) {
        doc.text(`--- Unit ${i} of ${qty} ---`);
        doc.font('Helvetica').fontSize(11);
        // Add checkboxes with larger gaps for manual marking
        const checklist = '[  ] Cutting         [  ] Sewing         [  ] Finishing         [  ] Quality Check         [  ] Completed';
        doc.text(checklist);
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(11);
      }
      
      doc.moveDown(1);
    });

    // Line separator
    doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(1);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
// ==================== BILLING INVOICE PDF ====================

app.get('/api/billing/:orderId/invoice', authenticate, async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = await all('SELECT * FROM order_items WHERE orderId = ? ORDER BY itemIndex ASC, description ASC', [orderId]);
    const payments = await all('SELECT * FROM payments WHERE orderId = ? ORDER BY paymentDate ASC', [orderId]);

    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=BillingInvoice-ORD${orderId}.pdf`,
        'Content-Length': pdfData.length
      });
      res.send(pdfData);
    });

    // ---- Header ----
    doc.fontSize(22).font('Helvetica-Bold').text('BILLING INVOICE', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#666').text('TailorApp', { align: 'center' });
    doc.fillColor('#000');
    doc.moveDown(1);

    // ---- Order & Client Info ----
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Invoice #: INV-${String(orderId).padStart(4, '0')}`, 50);
    doc.font('Helvetica');
    doc.text(`Order Date: ${order.createdAt.split('T')[0]}`);
    if (order.deliveryDate) doc.text(`Delivery Date: ${order.deliveryDate}`);
    doc.text(`Print Date: ${new Date().toISOString().split('T')[0]}`);
    doc.text(`Client: ${order.customerName}`);
    doc.text(`Status: ${order.status}`);
    doc.moveDown(1);

    // ---- Line ----
    doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(0.8);

    // ---- Items Table Header ----
    doc.font('Helvetica-Bold').fontSize(10);
    const hdrY = doc.y;
    doc.text('#', 50, hdrY, { width: 25 });
    doc.text('Item', 75, hdrY, { width: 200 });
    doc.text('Qty', 280, hdrY, { width: 40, align: 'center' });
    doc.text('Unit Price', 325, hdrY, { width: 70, align: 'right' });
    doc.text('Total', 400, hdrY, { width: 80, align: 'right' });

    doc.moveTo(50, doc.y + 5).lineTo(540, doc.y + 5).stroke();
    doc.moveDown(1);

    // ---- Items Rows ----
    doc.font('Helvetica').fontSize(10);
    items.forEach((item, idx) => {
      const qty = item.quantity || 1;
      const rowTotal = Number(item.price) * qty;
      const rowY = doc.y;
      doc.text(String(idx + 1), 50, rowY, { width: 25 });
      doc.text(`${item.description} (${item.clothColor}, ${item.size})`, 75, rowY, { width: 200 });
      doc.text(String(qty), 280, rowY, { width: 40, align: 'center' });
      doc.text(`${Number(item.price).toFixed(2)}`, 325, rowY, { width: 70, align: 'right' });
      doc.text(`${rowTotal.toFixed(2)}`, 400, rowY, { width: 80, align: 'right' });
      doc.moveDown(0.6);
    });

    // ---- Totals ----
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(0.8);

    const paidAmount = Number(order.paidAmount || 0);
    const due = Number(order.total) - paidAmount;

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`Grand Total:  BDT ${Number(order.total).toFixed(2)}`, { align: 'right' });
    doc.moveDown(0.3);
    doc.fillColor('#22883e').text(`Paid:  BDT ${paidAmount.toFixed(2)}`, { align: 'right' });
    doc.fillColor('#cc0000').text(`Due:  BDT ${due.toFixed(2)}`, { align: 'right' });
    doc.fillColor('#000');

    // ---- Payment History ----
    if (payments.length > 0) {
      doc.moveDown(1.5);
      doc.font('Helvetica-Bold').fontSize(12).text('Payment History');
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(9);
      const phY = doc.y;
      doc.text('Date', 50, phY, { width: 120 });
      doc.text('Amount', 180, phY, { width: 80, align: 'right' });
      doc.text('Note', 270, phY, { width: 200 });
      doc.moveTo(50, doc.y + 4).lineTo(540, doc.y + 4).stroke();
      doc.moveDown(0.8);

      doc.font('Helvetica').fontSize(9);
      payments.forEach(p => {
        const pY = doc.y;
        doc.text(p.paymentDate?.split('T')[0] || '', 50, pY, { width: 120 });
        doc.text(`BDT ${Number(p.amount).toFixed(2)}`, 180, pY, { width: 80, align: 'right' });
        doc.text(p.note || '—', 270, pY, { width: 200 });
        doc.moveDown(0.5);
      });
    }

    // ---- Footer ----
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#888').text('Thank you for your business!', { align: 'center' });
    doc.fillColor('#000');

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk billing invoice PDF (multiple invoices in one PDF, each on a new page)
app.get('/api/billing/bulk-invoice', authenticate, async (req, res) => {
  const idsParam = req.query.orderIds;
  if (!idsParam) return res.status(400).json({ error: 'No orderIds provided' });
  const orderIds = idsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
  if (orderIds.length === 0) return res.status(400).json({ error: 'Invalid orderIds' });

  try {
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=BulkBillingInvoices.pdf`,
        'Content-Length': pdfData.length
      });
      res.send(pdfData);
    });

    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i];
      const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
      if (!order) continue; // Skip invalid orders

      const items = await all('SELECT * FROM order_items WHERE orderId = ? ORDER BY itemIndex ASC, description ASC', [orderId]);
      const payments = await all('SELECT * FROM payments WHERE orderId = ? ORDER BY paymentDate ASC', [orderId]);

      if (i > 0) {
        doc.addPage();
      }

      // ---- Header ----
      doc.fontSize(22).font('Helvetica-Bold').text('BILLING INVOICE', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor('#666').text('TailorApp', { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);

      // ---- Order & Client Info ----
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`Invoice #: INV-${String(orderId).padStart(4, '0')}`, 50);
      doc.font('Helvetica');
      doc.text(`Order Date: ${order.createdAt.split('T')[0]}`);
      if (order.deliveryDate) doc.text(`Delivery Date: ${order.deliveryDate}`);
      doc.text(`Print Date: ${new Date().toISOString().split('T')[0]}`);
      doc.text(`Client: ${order.customerName}`);
      doc.text(`Status: ${order.status}`);
      doc.moveDown(1);

      // ---- Line ----
      doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
      doc.moveDown(0.8);

      // ---- Items Table Header ----
      doc.font('Helvetica-Bold').fontSize(10);
      const hdrY = doc.y;
      doc.text('#', 50, hdrY, { width: 25 });
      doc.text('Item', 75, hdrY, { width: 200 });
      doc.text('Qty', 280, hdrY, { width: 40, align: 'center' });
      doc.text('Unit Price', 325, hdrY, { width: 70, align: 'right' });
      doc.text('Total', 400, hdrY, { width: 80, align: 'right' });

      doc.moveTo(50, doc.y + 5).lineTo(540, doc.y + 5).stroke();
      doc.moveDown(1);

      // ---- Items Rows ----
      doc.font('Helvetica').fontSize(10);
      items.forEach((item, idx) => {
        const qty = item.quantity || 1;
        const rowTotal = Number(item.price) * qty;
        const rowY = doc.y;
        doc.text(String(idx + 1), 50, rowY, { width: 25 });
        doc.text(`${item.description} (${item.clothColor}, ${item.size})`, 75, rowY, { width: 200 });
        doc.text(String(qty), 280, rowY, { width: 40, align: 'center' });
        doc.text(`${Number(item.price).toFixed(2)}`, 325, rowY, { width: 70, align: 'right' });
        doc.text(`${rowTotal.toFixed(2)}`, 400, rowY, { width: 80, align: 'right' });
        doc.moveDown(0.6);
      });

      // ---- Totals ----
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
      doc.moveDown(0.8);

      const paidAmount = Number(order.paidAmount || 0);
      const due = Number(order.total) - paidAmount;

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text(`Grand Total:  BDT ${Number(order.total).toFixed(2)}`, { align: 'right' });
      doc.moveDown(0.3);
      doc.fillColor('#22883e').text(`Paid:  BDT ${paidAmount.toFixed(2)}`, { align: 'right' });
      doc.fillColor('#cc0000').text(`Due:  BDT ${due.toFixed(2)}`, { align: 'right' });
      doc.fillColor('#000');

      // ---- Payment History ----
      if (payments.length > 0) {
        doc.moveDown(1.5);
        doc.font('Helvetica-Bold').fontSize(12).text('Payment History');
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').fontSize(9);
        const phY = doc.y;
        doc.text('Date', 50, phY, { width: 120 });
        doc.text('Amount', 180, phY, { width: 80, align: 'right' });
        doc.text('Note', 270, phY, { width: 200 });
        doc.moveTo(50, doc.y + 4).lineTo(540, doc.y + 4).stroke();
        doc.moveDown(0.8);

        doc.font('Helvetica').fontSize(9);
        payments.forEach(p => {
          const pY = doc.y;
          doc.text(p.paymentDate?.split('T')[0] || '', 50, pY, { width: 120 });
          doc.text(`BDT ${Number(p.amount).toFixed(2)}`, 180, pY, { width: 80, align: 'right' });
          doc.text(p.note || '—', 270, pY, { width: 200 });
          doc.moveDown(0.5);
        });
      }

      // ---- Footer ----
      doc.moveDown(2);
      doc.fontSize(9).fillColor('#888').text('Thank you for your business!', { align: 'center' });
      doc.fillColor('#000');
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== BILLING API ====================

// Get all delivered orders with billing info
app.get('/api/billing', authenticate, async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'master') {
      orders = await all(
        'SELECT id, clientId, customerName, total, paidAmount, status, createdAt FROM orders WHERE status IN (?, ?) ORDER BY createdAt DESC',
        ['Delivered', 'Paid']
      );
    } else {
      const clientRecord = await get('SELECT id FROM clients WHERE userId = ?', [req.user.userId]);
      if (clientRecord) {
        orders = await all(
          'SELECT id, clientId, customerName, total, paidAmount, status, createdAt FROM orders WHERE clientId = ? AND status IN (?, ?) ORDER BY createdAt DESC',
          [clientRecord.id, 'Delivered', 'Paid']
        );
      } else {
        orders = await all(
          'SELECT id, clientId, customerName, total, paidAmount, status, createdAt FROM orders WHERE userId = ? AND status IN (?, ?) ORDER BY createdAt DESC',
          [req.user.userId, 'Delivered', 'Paid']
        );
      }
    }
    const billing = orders.map(o => ({
      ...o,
      due: Number(o.total) - Number(o.paidAmount || 0),
      billStatus: Number(o.paidAmount || 0) === 0 ? 'Due' :
                  Number(o.paidAmount || 0) >= Number(o.total) ? 'Paid' : 'Partial'
    }));
    res.json(billing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Record payment for a single order (full or partial)
app.post('/api/billing/:orderId/pay', authenticate, requirePermission('billing'), async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const { amount, note } = req.body;
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid payment amount' });
  }
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const currentPaid = Number(order.paidAmount || 0);
    const remaining = Number(order.total) - currentPaid;
    const payAmount = Math.min(Number(amount), remaining);

    if (payAmount <= 0) {
      return res.status(400).json({ error: 'This order is already fully paid' });
    }

    // Insert payment record
    await run(
      'INSERT INTO payments (orderId, amount, paymentDate, note) VALUES (?, ?, ?, ?) RETURNING id',
      [orderId, payAmount, new Date().toISOString(), note || '']
    );

    // Update order paidAmount
    const newPaid = currentPaid + payAmount;
    const newStatus = newPaid >= Number(order.total) ? 'Paid' : order.status;
    await run('UPDATE orders SET paidAmount = ?, status = ? WHERE id = ?', [newPaid, newStatus, orderId]);

    res.json({
      message: `Payment of ৳${payAmount} recorded successfully`,
      paidAmount: newPaid,
      due: Number(order.total) - newPaid,
      billStatus: newPaid >= Number(order.total) ? 'Paid' : 'Partial'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk payment — collect for multiple invoices at once (each can be partial)
app.post('/api/billing/bulk-pay', authenticate, requirePermission('billing'), async (req, res) => {
  const { payments: paymentsList } = req.body;
  // paymentsList = [{ orderId, amount, note }, ...]
  if (!Array.isArray(paymentsList) || paymentsList.length === 0) {
    return res.status(400).json({ error: 'No payments provided' });
  }

  const results = [];
  try {
    for (const p of paymentsList) {
      const orderId = Number(p.orderId);
      const amount = Number(p.amount);
      if (!orderId || amount <= 0) continue;

      const order = await get('SELECT * FROM orders WHERE id = ? AND userId = ?', [orderId, req.user.userId]);
      if (!order) continue;

      const currentPaid = Number(order.paidAmount || 0);
      const remaining = Number(order.total) - currentPaid;
      const payAmount = Math.min(amount, remaining);

      if (payAmount <= 0) continue;

      await run(
        'INSERT INTO payments (orderId, amount, paymentDate, note) VALUES (?, ?, ?, ?) RETURNING id',
        [orderId, payAmount, new Date().toISOString(), p.note || 'Bulk collection']
      );

      const newPaid = currentPaid + payAmount;
      const newStatus = newPaid >= Number(order.total) ? 'Paid' : order.status;
      await run('UPDATE orders SET paidAmount = ?, status = ? WHERE id = ?', [newPaid, newStatus, orderId]);

      results.push({ orderId, paid: payAmount, newTotal: newPaid, status: newPaid >= Number(order.total) ? 'Paid' : 'Partial' });
    }

    res.json({ message: `${results.length} payment(s) recorded`, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Payment history (all payments, filterable by date)
app.get('/api/billing/history', authenticate, async (req, res) => {
  try {
    const payments = await all(
      `SELECT p.id, p.orderId, p.amount, p.paymentDate, p.note, o.customerName, o.total
       FROM payments p
       JOIN orders o ON p.orderId = o.id
       WHERE o.userId = ?
       ORDER BY p.paymentDate DESC`,
      [req.user.userId]
    );
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ACCOUNTING / EXPENSES API ====================

// Get all expenses (with optional date filters via query params)
app.get('/api/expenses', authenticate, requirePermission('billing'), async (req, res) => {
  try {
    const expenses = await all('SELECT * FROM expenses ORDER BY expenseDate DESC, id DESC');
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new expense
app.post('/api/expenses', authenticate, requirePermission('billing'), async (req, res) => {
  const { category, amount, note, expenseDate } = req.body;
  if (!category || !amount || Number(amount) <= 0 || !expenseDate) {
    return res.status(400).json({ error: 'Category, amount (>0), and date are required' });
  }
  try {
    const result = await run(
      'INSERT INTO expenses (category, amount, note, expenseDate, createdAt) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [category.trim(), Number(amount), note || '', expenseDate, new Date().toISOString()]
    );
    res.json({ id: result.lastID, message: '✅ Expense added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete expense
app.delete('/api/expenses/:id', authenticate, requirePermission('billing'), async (req, res) => {
  try {
    await run('DELETE FROM expenses WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accounting summary — income from payments, expenses, profit/loss
app.get('/api/accounting/summary', authenticate, requirePermission('billing'), async (req, res) => {
  try {
    // Total income (all payments collected)
    const incomeRow = await get('SELECT COALESCE(SUM(amount), 0) AS total FROM payments');
    const totalIncome = Number(incomeRow.total);

    // Total expenses
    const expenseRow = await get('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses');
    const totalExpenses = Number(expenseRow.total);

    // Monthly breakdown (last 12 months)
    const monthlyIncome = await all(`
      SELECT TO_CHAR(TO_TIMESTAMP(paymentDate, 'YYYY-MM-DD'), 'YYYY-MM') AS month,
             SUM(amount) AS total
      FROM payments
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);

    const monthlyExpenses = await all(`
      SELECT TO_CHAR(TO_TIMESTAMP(expenseDate, 'YYYY-MM-DD'), 'YYYY-MM') AS month,
             SUM(amount) AS total
      FROM expenses
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);

    // Expense by category
    const expenseByCategory = await all(`
      SELECT category, SUM(amount) AS total, COUNT(*) AS count
      FROM expenses
      GROUP BY category
      ORDER BY total DESC
    `);

    res.json({
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      monthlyIncome,
      monthlyExpenses,
      expenseByCategory
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get expense categories (for autocomplete)
app.get('/api/expenses/categories', authenticate, requirePermission('billing'), async (req, res) => {
  try {
    const cats = await all('SELECT DISTINCT category FROM expenses ORDER BY category ASC');
    res.json(cats.map(c => c.category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n  ✅ Backend running at http://localhost:${PORT}`);
});
