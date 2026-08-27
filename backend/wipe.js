require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/tailorapp';

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function wipeDB() {
  const client = await pool.connect();
  try {
    console.log('Connected to DB. Starting to drop remaining tables...');
    await client.query('DROP TABLE IF EXISTS payments CASCADE');
    await client.query('DROP TABLE IF EXISTS workflow_steps CASCADE');
    await client.query('DROP TABLE IF EXISTS order_item_materials CASCADE');
    await client.query('DROP TABLE IF EXISTS order_items CASCADE');
    await client.query('DROP TABLE IF EXISTS billing CASCADE');
    await client.query('DROP TABLE IF EXISTS invoice_items CASCADE');
    await client.query('DROP TABLE IF EXISTS order_materials CASCADE');
    await client.query('DROP TABLE IF EXISTS orders CASCADE');
    await client.query('DROP TABLE IF EXISTS clients CASCADE');
    await client.query('DROP TABLE IF EXISTS product_materials CASCADE');
    await client.query('DROP TABLE IF EXISTS products CASCADE');
    await client.query('DROP TABLE IF EXISTS materials CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('All tables dropped successfully.');
  } catch (err) {
    console.error('Error dropping tables:', err);
  } finally {
    client.release();
    pool.end();
  }
}

wipeDB();
