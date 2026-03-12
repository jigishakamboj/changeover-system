const db = require('./database/database');

db.all("PRAGMA table_info(changeovers);", (err, rows) => {

if(err){
console.log(err);
return;
}

console.log("TABLE STRUCTURE:");
console.log(rows);

});