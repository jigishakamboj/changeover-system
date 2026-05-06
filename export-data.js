const { pool } = require('./database/database.js');
const fs = require('fs');

async function exportData() {
  try {
    const result = await pool.query('SELECT * FROM changeovers');

    const rows = result.rows;

    if (rows.length === 0) {
      console.log("No data found");
      return;
    }

    const headers = Object.keys(rows[0]).join(',');

    const csv = rows.map(row =>
      Object.values(row).map(v => `"${v}"`).join(',')
    );

    const finalCSV = [headers, ...csv].join('\n');

    fs.writeFileSync('backup.csv', finalCSV);

    console.log("✅ Data exported to backup.csv");

  } catch (err) {
    console.error("❌ Export error:", err);
  } finally {
    pool.end();
  }
}

exportData();