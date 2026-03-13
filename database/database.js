const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database file in project root
const dbPath = path.join(__dirname, 'changeovers.db');
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

    db.run(`ALTER TABLE changeovers ADD COLUMN fabric_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN panels_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN thread_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN trims_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN labels_ready INTEGER DEFAULT 0`, ()=>{});

    db.run(`ALTER TABLE changeovers ADD COLUMN attachments_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN needle_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN presser_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN bobbins_ready INTEGER DEFAULT 0`, ()=>{});

    db.run(`ALTER TABLE changeovers ADD COLUMN techpack_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN operation_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN sample_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN quality_ready INTEGER DEFAULT 0`, ()=>{});

    db.run(`ALTER TABLE changeovers ADD COLUMN operators_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN workstation_ready INTEGER DEFAULT 0`, ()=>{});
    db.run(`ALTER TABLE changeovers ADD COLUMN line_balance_ready INTEGER DEFAULT 0`, ()=>{});

});

module.exports = db;


