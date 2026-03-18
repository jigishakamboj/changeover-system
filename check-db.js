const db = require('./database/database');

db.all("PRAGMA table_info(changeovers);", (err, rows) => {

if(err){
console.log(err);
return;
}

console.log("TABLE STRUCTURE:");
console.log(rows);

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database/changeovers.db');

console.log("Using DB file at:", './database/changeovers.db');

db.all("SELECT id, changeover_id, status FROM changeovers", (err, rows) => {

    if (err) {
        console.error(err);
        return;
    }

    console.log("CHANGEOVERS:");
    console.log(rows);

});

});