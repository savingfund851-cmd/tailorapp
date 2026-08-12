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
      role VARCHAR(50) NOT NULL DEFAULT 'master'
    )`);

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

    await client.query(`CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      orderId INTEGER NOT NULL REFERENCES orders(id),
      description TEXT NOT NULL,
      clothColor VARCHAR(100) NOT NULL,
      size VARCHAR(50) NOT NULL,
      measurements TEXT NOT NULL,
      price REAL NOT NULL
    )`);

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
  return res.rows[0] || null;
}

async function all(sql, params = []) {
  const pgSql = convertSqliteToPg(sql);
  const res = await pool.query(pgSql, params);
  return res.rows;
}

module.exports = { pool, init, run, get, all };
