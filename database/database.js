const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// =====================
// POSTGRES (MAIN DB)
// =====================

const pool = new Pool({
  connectionString: "postgresql://changeover_user:gLZh8uTF9KKNEJsgL7Seygm1VhzveguR@dpg-d71p8u5m5p6s739unof0-a.oregon-postgres.render.com/changeover",
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ PostgreSQL connection error:', err);
  } else {
    console.log('✅ PostgreSQL connected:', res.rows[0]);
  }
});

// =====================
// CREATE TABLE
// =====================

pool.query(`
CREATE TABLE IF NOT EXISTS changeovers (
    id SERIAL PRIMARY KEY,
    changeover_id TEXT,
    date TEXT,
    line TEXT,
    from_style TEXT,
    to_style TEXT,
    status TEXT,
    start_time TEXT,
    end_time TEXT,
    duration_minutes INTEGER,
    deduction_minutes INTEGER,
    final_minutes INTEGER,
    ramp_up_days INTEGER,
    bucket_loss INTEGER,
    major_delay TEXT,
    type TEXT DEFAULT 'post',

    from_product_type TEXT,
    to_product_type TEXT,
    machine_types TEXT,
    needle_req TEXT,
    throat_plate TEXT,
    presser_foot TEXT,
    feed_dog TEXT,
    binders TEXT,
    attachments TEXT,
    templates TEXT,
    critical_operations TEXT
);
`, (err) => {
  if (err) console.error("❌ Error creating table:", err);
  else console.log("✅ PostgreSQL table ready");
});

// =====================
// ⚠️ TEMP FIX (RUN ONCE)
// =====================

pool.query(`
ALTER TABLE changeovers
ADD COLUMN IF NOT EXISTS from_product_type TEXT,
ADD COLUMN IF NOT EXISTS to_product_type TEXT,
ADD COLUMN IF NOT EXISTS machine_types TEXT,
ADD COLUMN IF NOT EXISTS needle_req TEXT,
ADD COLUMN IF NOT EXISTS throat_plate TEXT,
ADD COLUMN IF NOT EXISTS presser_foot TEXT,
ADD COLUMN IF NOT EXISTS feed_dog TEXT,
ADD COLUMN IF NOT EXISTS binders TEXT,
ADD COLUMN IF NOT EXISTS attachments TEXT,
ADD COLUMN IF NOT EXISTS templates TEXT,
ADD COLUMN IF NOT EXISTS critical_operations TEXT,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'post';
`, (err) => {
  if (err) console.log("ALTER error:", err);
  else console.log("✅ Columns ensured");
});

// =====================
// SQLITE (OPTIONAL)
// =====================

const dbPath = path.join(process.cwd(), 'database', 'changeovers.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("SQLite error:", err.message);
  else console.log("Connected to SQLite database.");
});

module.exports = { db, pool };