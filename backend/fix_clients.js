require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const c = await pool.connect();
  try {
    const users = await c.query("SELECT id, username FROM users WHERE role != 'master'");
    for (const u of users.rows) {
      const existing = await c.query('SELECT id FROM clients WHERE userid = $1', [u.id]);
      if (existing.rows.length === 0) {
        await c.query(
          'INSERT INTO clients (userid, name, phone, address, createdat) VALUES ($1, $2, $3, $4, $5)',
          [u.id, u.username, '', '', new Date().toISOString()]
        );
        console.log(`Created client record for user: ${u.username}`);
      }
    }
    const r = await c.query('SELECT * FROM clients');
    console.log('All clients now:');
    r.rows.forEach(row => console.log(JSON.stringify(row)));
  } finally {
    c.release();
    pool.end();
  }
})();
