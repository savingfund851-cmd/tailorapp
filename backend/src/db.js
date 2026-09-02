const { Pool } = require('pg');

// Use DATABASE_URL from environment for production, fallback to local for dev
const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/tailorapp';

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false // Required for Neon
});

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'master',
      userType VARCHAR(50) NOT NULL DEFAULT 'client',
      permissions TEXT DEFAULT '{}'
    )`);

    // Add new columns if they don't exist (migration for existing DBs)
    try { await client.query(`ALTER TABLE users ADD COLUMN userType VARCHAR(50) NOT NULL DEFAULT 'client'`); } catch(e) {}
    try { await client.query(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '{}'`); } catch(e) {}
    try { await client.query(`ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'`); } catch(e) {}

    await client.query(`CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      unit VARCHAR(50) NOT NULL,
      stock REAL NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      basePrice REAL NOT NULL,
      defaultMeasurements TEXT,
      createdAt VARCHAR(255) NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS product_materials (
      id SERIAL PRIMARY KEY,
      productId INTEGER NOT NULL REFERENCES products(id),
      materialId INTEGER NOT NULL REFERENCES materials(id),
      quantity REAL NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      userId INTEGER NOT NULL REFERENCES users(id),
      productId INTEGER,
      customerName VARCHAR(255) NOT NULL,
      total REAL NOT NULL,
      status VARCHAR(50) NOT NULL,
      createdAt VARCHAR(255) NOT NULL
    )`);

    // Add productId column if it doesn't exist (for existing tables)
    try {
      await client.query(`ALTER TABLE orders ADD COLUMN productId INTEGER REFERENCES products(id)`);
    } catch (e) {
      // Column might already exist
    }

    await client.query(`CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      userId INTEGER REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      createdAt VARCHAR(255) NOT NULL
    )`);

    try {
      await client.query(`ALTER TABLE orders ADD COLUMN clientId INTEGER REFERENCES clients(id)`);
    } catch (e) {
      // Column might already exist
    }

    // Add new product columns
    try {
      await client.query(`ALTER TABLE products ADD COLUMN colors TEXT`);
      await client.query(`ALTER TABLE products ADD COLUMN sizeGroup VARCHAR(50)`);
      await client.query(`ALTER TABLE products ADD COLUMN sizes TEXT`);
      await client.query(`ALTER TABLE products ADD COLUMN remarks TEXT`);
    } catch (e) {
      // Columns might already exist
    }

    await client.query(`CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      orderId INTEGER NOT NULL REFERENCES orders(id),
      description TEXT NOT NULL,
      clothColor VARCHAR(100) NOT NULL,
      size VARCHAR(50) NOT NULL,
      measurements TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      itemIndex INTEGER DEFAULT 0,
      workflowStep VARCHAR(50) DEFAULT 'Pending'
    )`);

    try { await client.query(`ALTER TABLE order_items ADD COLUMN quantity INTEGER DEFAULT 1`); } catch (e) {}
    try { await client.query(`ALTER TABLE order_items ADD COLUMN itemIndex INTEGER DEFAULT 0`); } catch (e) {}
    try { await client.query(`ALTER TABLE order_items ADD COLUMN workflowStep VARCHAR(50) DEFAULT 'Pending'`); } catch (e) {}

    await client.query(`CREATE TABLE IF NOT EXISTS order_item_materials (
      id SERIAL PRIMARY KEY,
      orderItemId INTEGER NOT NULL REFERENCES order_items(id),
      materialId INTEGER NOT NULL REFERENCES materials(id),
      quantity REAL NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS workflow_steps (
      id SERIAL PRIMARY KEY,
      orderId INTEGER NOT NULL REFERENCES orders(id),
      step VARCHAR(100) NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0
    )`);

    // Create indexes for fast lookups
    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_order_items_orderid ON order_items(orderId)`); } catch(e) {}
    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_order_item_materials_orderitemid ON order_item_materials(orderItemId)`); } catch(e) {}
    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_workflow_steps_orderid ON workflow_steps(orderId)`); } catch(e) {}
    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_userid ON orders(userId)`); } catch(e) {}
    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_clientid ON orders(clientId)`); } catch(e) {}
    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`); } catch(e) {}
    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_product_materials_productid ON product_materials(productId)`); } catch(e) {}

    await client.query(`CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      orderId INTEGER NOT NULL REFERENCES orders(id),
      amount REAL NOT NULL,
      paymentDate VARCHAR(255) NOT NULL,
      note TEXT
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      expenseDate VARCHAR(255) NOT NULL,
      createdAt VARCHAR(255) NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS expense_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL
    )`);

    try { await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expenseDate)`); } catch(e) {}

    // Add paidAmount column to orders
    try {
      await client.query(`ALTER TABLE orders ADD COLUMN paidAmount REAL DEFAULT 0`);
    } catch (e) {
      // Column might already exist
    }

    // Seed admin user if no users exist
    const userRes = await client.query('SELECT COUNT(*) AS cnt FROM users');
    if (parseInt(userRes.rows[0].cnt) === 0) {
      const allPerms = JSON.stringify({ orders: true, billing: true, inventory: true, products: true, createOrder: true });
      await client.query(
        `INSERT INTO users (username, password, role, userType, permissions) VALUES ($1, $2, $3, $4, $5)`,
        ['admin', 'admin123', 'master', 'admin', allPerms]
      );
      console.log('Seeded admin user (admin / admin123).');
    }

    // Seed raw materials if empty
    const res = await client.query('SELECT COUNT(*) AS cnt FROM materials');
    if (parseInt(res.rows[0].cnt) === 0) {
      const seed = [
        ['Cotton Cloth', 'meters', 500],
        ['Silk Cloth', 'meters', 200],
        ['Suiting Fabric', 'meters', 150],
        ['Buttons', 'pcs', 1000],
        ['Zipper', 'pcs', 300],
        ['Thread Spool', 'pcs', 200]
      ];
      for (const v of seed) {
        await client.query('INSERT INTO materials (name, unit, stock) VALUES ($1, $2, $3)', v);
      }
      console.log('Seeded raw materials (PostgreSQL).');
    }

    // Seed expense categories if empty
    const catRes = await client.query('SELECT COUNT(*) AS cnt FROM expense_categories');
    if (parseInt(catRes.rows[0].cnt) === 0) {
      const presets = [
        'Rent', 'Utilities', 'Raw Materials', 'Fabric Purchase', 'Thread & Accessories',
        'Staff Salary', 'Transport', 'Machine Maintenance', 'Marketing', 'Food & Snacks',
        'Miscellaneous', 'Equipment', 'Packaging', 'Office Supplies', 'Phone & Internet'
      ];
      for (const cat of presets) {
        await client.query('INSERT INTO expense_categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [cat]);
      }
      console.log('Seeded expense categories.');
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  } finally {
    client.release();
  }
}

// PostgreSQL adapter for our existing helpers
// Replace '?' with '$1', '$2', etc. in the SQL string
function convertSqliteToPg(sql) {
  let paramCount = 1;
  return sql.replace(/\?/g, () => `$${paramCount++}`);
}

const camelMap = {
  baseprice: 'basePrice',
  defaultmeasurements: 'defaultMeasurements',
  createdat: 'createdAt',
  sizegroup: 'sizeGroup',
  productid: 'productId',
  materialid: 'materialId',
  userid: 'userId',
  customername: 'customerName',
  orderid: 'orderId',
  clothcolor: 'clothColor',
  orderitemid: 'orderItemId',
  paidamount: 'paidAmount',
  paymentdate: 'paymentDate',
  usertype: 'userType',
  clientid: 'clientId',
  itemindex: 'itemIndex',
  workflowstep: 'workflowStep',
  expensedate: 'expenseDate'
};

function mapRow(row) {
  if (!row) return row;
  const mapped = {};
  for (const key in row) {
    mapped[camelMap[key] || key] = row[key];
  }
  return mapped;
}

async function run(sql, params = []) {
  const pgSql = convertSqliteToPg(sql);
  const res = await pool.query(pgSql, params);
  // SQLite returns lastID on INSERT, pg doesn't by default unless RETURNING is used
  // We handle RETURNING id manually where needed in server.js, but fallback just in case
  return { lastID: res.rows.length > 0 ? res.rows[0].id : null, changes: res.rowCount };
}

async function get(sql, params = []) {
  const pgSql = convertSqliteToPg(sql);
  const res = await pool.query(pgSql, params);
  return mapRow(res.rows[0] || null);
}

async function all(sql, params = []) {
  const pgSql = convertSqliteToPg(sql);
  const res = await pool.query(pgSql, params);
  return res.rows.map(mapRow);
}

module.exports = { pool, init, run, get, all, camelMap };
