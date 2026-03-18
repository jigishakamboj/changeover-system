const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database/changeovers.db');

console.log("Using DB file at:", './database/changeovers.db');

db.all("SELECT * FROM changeovers", (err, rows) => {

    if (err) {
        console.error(err);
        return;
    }

    console.log("ALL CHANGEOVERS:");
    console.log(rows);

});