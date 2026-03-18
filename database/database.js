const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// IMPORTANT: Use stable absolute path for deployment
const dbPath = path.join(process.cwd(), 'database', 'changeovers.db');

console.log("Using DB file at:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database connection error:", err.message);
    } else {
        console.log("Connected to SQLite database.");
    }
});

// Create table if not exists
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS changeovers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            major_delay TEXT
        )
    `);

    // =========================
    // READINESS CHECKLIST FIELDS
    // =========================

    const columns = [
        "fabric_ready",
        "panels_ready",
        "thread_ready",
        "trims_ready",
        "labels_ready",
        "attachments_ready",
        "needle_ready",
        "presser_ready",
        "bobbins_ready",
        "techpack_ready",
        "operation_ready",
        "sample_ready",
        "quality_ready",
        "operators_ready",
        "workstation_ready",
        "line_balance_ready"
    ];

    columns.forEach(col => {
        db.run(`ALTER TABLE changeovers ADD COLUMN ${col} INTEGER DEFAULT 0`, () => {});
    });

});

module.exports = db;