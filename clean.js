const db = require('./database/database');

db.run(
  "DELETE FROM changeovers WHERE changeover_id = ''",
  function (err) {
    if (err) {
      console.error(err);
    } else {
      console.log("Deleted empty rows:", this.changes);
    }
    process.exit();
  }
);