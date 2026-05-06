const { pool } = require('./database/database.js');

async function insertPostData() {
  try {

    await pool.query(`
      INSERT INTO changeovers 
      (changeover_id, date, line, from_style, to_style, final_minutes, ramp_up_days, bucket_loss, status, type)
      VALUES
      ('CO12','2026-03-12','1/2','346422','3772/630',105,1,533,'closed','post'),
      ('CO13','2026-03-17','4/5','1377/111','1377/113',110,0,123,'closed','post'),
      ('CO14','2026-03-23','4/5','1377/113','144853',116,2,321,'closed','post'),
      ('CO15','2026-04-06','1/2','3772/630','346433',117,1,189,'closed','post'),
      ('CO16','2026-04-14','1/2','346433','3772/323',122,1,166,'closed','post'),
      ('CO17','2026-04-22','1/2','3772/323','346658',123,1,176,'closed','post'),
      ('CO18','2026-04-23','1/2','346658','346635',118,2,286,'closed','post'),
      ('CO19','2026-04-26','1/2','346635','144905',115,2,256,'closed','post'),
      ('CO20','2026-05-01','1/2','144905','144904',114,1,179,'closed','post')
    `);

    console.log("✅ POST data inserted");

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    pool.end();
  }
}

insertPostData();