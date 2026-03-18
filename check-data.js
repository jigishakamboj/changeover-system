const db = require('./database/database');

db.all("SELECT * FROM changeovers", (err, rows) => {

    if(err){
        console.log(err);
        return;
    }

    console.log("All Changeovers:");
    console.table(rows);

});