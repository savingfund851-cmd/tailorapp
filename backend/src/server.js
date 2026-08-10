const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const path = require('path');

// JWT secret
const JWT_SECRET = 'tailorapp-secret-key-2024';

// Database helpers
const { db, init, run, get, all } = require('./db');

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

// Register new user (plain‑text password for simplicity)
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(409).json({ error: 'Username exists' });
    const result = await run('INSERT INTO users (username, password) VALUES (?, ?) RETURNING id', [username, password]);
    const token = jwt.sign({ userId: result.lastID, username }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: { id: result.lastID, username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await get('SELECT id, username FROM users WHERE username = ? AND password = ?', [username, password]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Inventory
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
app.post('/api/inventory', authenticate, async (req, res) => {
  const { name, unit, stock } = req.body;
  if (!name || !unit || stock === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if material already exists
    const existing = await get('SELECT id, stock FROM materials WHERE name = ? AND unit = ?', [name, unit]);
    
    if (existing) {
      // Update existing stock
      await run('UPDATE materials SET stock = stock + ? WHERE id = ?', [Number(stock), existing.id]);
      res.json({ message: 'Stock updated successfully', id: existing.id });
    } else {
      // Add new material
      const result = await run('INSERT INTO materials (name, unit, stock) VALUES (?, ?, ?) RETURNING id', [name, unit, Number(stock)]);
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
  const { customerName, items } = req.body;
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

  try {
    await validateAndDeductStock(requiredMaterials);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // Calculate total
  let total = 0;
  for (const item of items) total += Number(item.price);

  // Insert order
  let orderResult;
  try {
    orderResult = await run(
      'INSERT INTO orders (userId, customerName, total, status, createdAt) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [req.user.userId, customerName, total, 'Processing', new Date().toISOString()]
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create order' });
  }
  const orderId = orderResult.lastID;

  // Insert order items and link materials
  for (const item of items) {
    const itemResult = await run(
      'INSERT INTO order_items (orderId, description, clothColor, size, measurements, price) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [orderId, item.description, item.clothColor, item.size, item.measurements, item.price]
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
  const steps = ['Cutting', 'Sewing', 'Finishing', 'Delivery'];
  for (const stepName of steps) {
    await run('INSERT INTO workflow_steps (orderId, step) VALUES (?, ?)', [orderId, stepName]);
  }

  res.status(201).json({ orderId, message: 'Custom order created successfully' });
});

// Get user's orders with items and workflow
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const orders = await all('SELECT * FROM orders WHERE userId = ?', [req.user.userId]);
    const detailed = [];
    for (const order of orders) {
      const items = await all('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
      // Attach materials per item
      for (const item of items) {
        const mats = await all(
          `SELECT m.name, m.unit, oim.quantity FROM order_item_materials oim JOIN materials m ON oim.materialId = m.id WHERE oim.orderItemId = ?`,
          [item.id]
        );
        item.materialsUsed = mats;
      }
      const workflow = await all('SELECT * FROM workflow_steps WHERE orderId = ?', [order.id]);
      detailed.push({ ...order, items, workflow });
    }
    res.json(detailed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Advance workflow step
app.put('/api/orders/:id/step', authenticate, async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { step } = req.body;
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const workflowStep = await get('SELECT * FROM workflow_steps WHERE orderId = ? AND step = ?', [orderId, step]);
    if (!workflowStep) return res.status(400).json({ error: 'Invalid step' });
    if (workflowStep.completed) return res.status(400).json({ error: 'Step already completed' });
    await run('UPDATE workflow_steps SET completed = 1 WHERE id = ?', [workflowStep.id]);
    // Update order status
    const allSteps = await all('SELECT * FROM workflow_steps WHERE orderId = ?', [orderId]);
    const allDone = allSteps.every(s => s.completed === 1);
    const newStatus = allDone ? 'Delivered' : (allSteps.find(s => s.completed === 0) || {}).step || 'Processing';
    await run('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);
    const updatedOrder = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.json({ message: `${step} completed`, order: { ...updatedOrder, workflow: allSteps } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Invoice PDF generation
app.get('/api/orders/:id/invoice', authenticate, async (req, res) => {
  const orderId = parseInt(req.params.id);
  try {
    const order = await get('SELECT * FROM orders WHERE id = ? AND userId = ?', [orderId, req.user.userId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = await all('SELECT * FROM order_items WHERE orderId = ?', [orderId]);

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Invoice-${orderId}.pdf`,
        'Content-Length': pdfData.length
      });
      res.send(pdfData);
    });

    // Header
    doc.fontSize(20).text('TailorApp Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice #: INV-${String(orderId).padStart(4, '0')}`);
    doc.text(`Date: ${order.createdAt.split('T')[0]}`);
    doc.text(`Customer: ${order.customerName}`);
    doc.moveDown();
    // Table header
    doc.font('Helvetica-Bold');
    doc.text('Item', 50, doc.y, { continued: true });
    doc.text('Qty', 300, doc.y, { continued: true });
    doc.text('Price', 350, doc.y, { continued: true });
    doc.text('Total', 420, doc.y);
    doc.moveDown();
    doc.font('Helvetica');
    // Items
    items.forEach(item => {
      const line = `${item.description} (${item.clothColor}, Size: ${item.size})`;
      doc.text(line, 50, doc.y, { continued: true });
      doc.text('1', 300, doc.y, { continued: true });
      doc.text(item.price.toFixed(2), 350, doc.y, { continued: true });
      doc.text(item.price.toFixed(2), 420, doc.y);
      doc.moveDown();
    });
    doc.moveDown();
    doc.font('Helvetica-Bold').text(`Total: $${order.total.toFixed(2)}`, { align: 'right' });
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n  ✅ Backend running at http://localhost:${PORT}`);
});
