const fs = require('fs');
const csv = require('csv-parser');
const db = require('./database/database');

let rows = [];

fs.createReadStream('./historical.csv')
  .pipe(csv())
  .on('data', (row) => {
    rows.push(row);
  })
  .on('end', () => {

    db.serialize(() => {

      const stmt = db.prepare(`
        INSERT INTO changeovers (
          changeover_id,
          date,
          line,
          from_style,
          to_style,
          status,
          duration_minutes,
          deduction_minutes,
          final_minutes,
          ramp_up_days,
          bucket_loss,
          major_delay
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      rows.forEach(row => {

        stmt.run(
          row['CO ID'],
          row['Date'],
          row['Line'],
          row['From Style no.'],      // FROM
          row['To Style no.'],      // TEMP: same as FROM
          row['Status'],
          Number(row['Loss duration (min)']) || 0,
          Number(row['Shift/ break deduction']) || 0,
          Number(row['Final minutes']) || 0,
          Number(row['Ramp up days']) || 0,
          Number(row['Bucket loss']) || 0,
          row['Major delay causes']
        );

      });

      stmt.finalize(() => {
        console.log('Clean import complete.');
        process.exit();
      });

    });

  });