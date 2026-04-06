const { db, pool}  = require('./database/database.js');
const express = require('express');  
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const USERNAME = "admin";
const PASSWORD = "1234";

// =====================
// FIX LINE DISPLAY FORMAT
// =====================

function formatLine(line) {
    if (!line) return "";

    // already correct
    if (typeof line === "string" && line.includes("/")) {
        return line;
    }

    const date = new Date(line);

    if (!isNaN(date)) {
        return `${date.getDate()}/${date.getMonth() + 1}`;
    }

    return line;
}

// =====================
// MIDDLEWARE
// =====================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

// =====================
// GLOBAL PENDING COUNT
// =====================

app.use(async (req, res, next) => {
  try {
    const result = await pool.query(`
    SELECT COUNT(*) AS count
    FROM changeovers
    WHERE status='closed'
    AND (bucket_loss IS NULL OR bucket_loss = 0)
`);
    res.locals.pendingCount = result.rows[0].count;

  } catch (err) {
    console.log(err);
    res.locals.pendingCount = 0;
  }

  next();
});

// =====================
// LOGIN
// =====================

app.get('/', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {

    const { username, password } = req.body;

    if (username === USERNAME && password === PASSWORD) {
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: "Invalid username or password" });
    }

});

// =====================
// NEW CHANGEOVER
// =====================

app.get('/new-changeover', (req, res) => {
    res.render('new-changeover', { changeover: null });
});

// =====================
// SAVE NEW CHANGEOVER
// =====================

app.post('/new-changeover', async (req, res) => {

  try {

    const {
      date,
      line,
      from_style,
      from_product_type,
      to_style,
      to_product_type,
      machine_types,
      needle_req,
      throat_plate,
      presser_foot,
      feed_dog,
      binders,
      attachments,
      templates,
      critical_operations
    } = req.body;

    // 🔧 FIX DATE FORMAT (dd-mm-yyyy → yyyy-mm-dd)
let formattedDate = date;

if (date && date.includes("-")) {
  const parts = date.split("-");

  // If user entered dd-mm-yyyy
  if (parts[0].length === 2) {
    const [dd, mm, yyyy] = parts;
    formattedDate = `${yyyy}-${mm}-${dd}`;
  }
}

    // ✅ Handle checkbox
    let machines = machine_types || [];
    if (!Array.isArray(machines)) machines = [machines];

    const machineTypesString = machines.join(',');

// 🔧 CLEAN CO ID GENERATION
const result = await pool.query("SELECT COUNT(*) FROM changeovers");
const count = parseInt(result.rows[0].count) + 1;


const changeoverId = "CO" + String(count).padStart(2, "0");


    await pool.query(`
      INSERT INTO changeovers (
        changeover_id,
        date,
        line,
        from_style,
        from_product_type,
        to_style,
        to_product_type,
        machine_types,
        needle_req,
        throat_plate,
        presser_foot,
        feed_dog,
        binders,
        attachments,
        templates,
        critical_operations,
        status,
        type
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        'planned',
        'post'
      )
    `, [
      changeoverId,
      formattedDate,
      line,
      from_style,
      from_product_type,
      to_style,
      to_product_type,
      machineTypesString,
      needle_req,
      throat_plate,
      presser_foot,
      feed_dog,
      binders,
      attachments,
      templates,
      critical_operations
    ]);

    console.log("✅ Changeover saved");

    res.redirect('/dashboard');

  } catch (err) {
    console.log("❌ Insert error:", err);
    res.send("Error saving changeover");
  }

});


// =====================
// EDIT CHANGEOVER PAGE
// =====================

app.get('/edit-changeover/:id', async (req, res) => {

    try {
        const result = await pool.query(
            "SELECT * FROM changeovers WHERE id = $1",
            [req.params.id]
        );

        const row = result.rows[0];

        if (!row) {
            return res.send("Changeover not found");
        }

        res.render('new-changeover', { changeover: row });

    } catch (err) {
        console.log(err);
        res.send("Error loading changeover");
    }

});

// =====================
// UPDATE CHANGEOVER
// =====================

app.post('/edit-changeover/:id', async (req, res) => {

    try {
        const id = req.params.id;

        const {
            ramp_up_days,
            bucket_loss,
            major_delay
        } = req.body;

        await pool.query(`
            UPDATE changeovers
            SET 
                ramp_up_days = $1,
                bucket_loss = $2,
                major_delay = $3
            WHERE id = $4
        `, [ramp_up_days, bucket_loss, major_delay, id]);

        console.log("✅ Changeover updated");

        res.redirect('/past-changeovers');

    } catch (err) {
        console.log(err);
        res.send("Update error");
    }

});

app.get('/dashboard', async (req,res)=>{

try {

const result = await pool.query("SELECT * FROM changeovers ORDER BY id DESC");
const rows = result.rows;

rows.forEach(r => {

  const checklistFields = [
    r.fabric_ready,
    r.panels_ready,
    r.thread_ready,
    r.trims_ready,
    r.labels_ready,
    r.attachments_ready,
    r.needle_ready,
    r.presser_ready,
    r.bobbins_ready,
    r.techpack_ready,
    r.operation_ready,
    r.sample_ready,
    r.quality_ready,
    r.operators_ready,
    r.workstation_ready,
    r.line_balance_ready
  ];

  const completed = checklistFields.filter(v => v === 1).length;

  r.readiness_percent = Math.round((completed / checklistFields.length) * 100);

});

const pre = rows.filter(r => r.type === 'pre');
const post = rows.filter(r => r.type === 'post');


const planned = rows.filter(r=>r.status==='planned');
const active = rows.filter(r=>r.status==='in_progress');
const closed = rows.filter(r=>r.status==='closed');

// =======================
// BEST & WORST CHANGEOVER
// =======================

let bestCO = "-";
let worstCO = "-";

if (closed.length > 0) {
    bestCO = Math.min(...closed.map(c => c.final_minutes || 0));
    worstCO = Math.max(...closed.map(c => c.final_minutes || 0));
}

// =======================
// TOP LOSS STYLE
// =======================

let topLossStyle = "-";
let topLossValue = 0;

if (closed.length > 0) {
    const worstLoss = closed.reduce((max, co) =>
        (co.bucket_loss || 0) > (max.bucket_loss || 0) ? co : max
    );

    topLossStyle = (worstLoss.from_style || "-") + " → " + (worstLoss.to_style || "-");
    topLossValue = worstLoss.bucket_loss || 0;
}

// =======================
// AVERAGES
// =======================

let avgSetup = 0;
let avgBucket = 0;

let preAvg = 0;
let postAvg = 0;

if (pre.length > 0) {
    preAvg = Math.round(
        pre.reduce((s,c)=>s+(c.final_minutes||0),0)/pre.length
    );
}

if (post.length > 0) {
    postAvg = Math.round(
        post.reduce((s,c)=>s+(c.final_minutes||0),0)/post.length
    );
}

let improvement = 0;

if (preAvg > 0 && postAvg > 0) {
    improvement = Math.round(((preAvg - postAvg)/preAvg)*100);
}


if (closed.length > 0) {
    avgSetup = Math.round(
        closed.reduce((sum,c)=>sum+(c.final_minutes||0),0) / closed.length
    );

    avgBucket = Math.round(
        closed.reduce((sum,c)=>sum+(c.bucket_loss||0),0) / closed.length
    );
}

const preLoss = pre.length > 0
  ? Math.round(pre.reduce((s, c) => s + (c.bucket_loss || 0), 0) / pre.length)
  : 0;

const postLoss = post.length > 0
  ? Math.round(post.reduce((s, c) => s + (c.bucket_loss || 0), 0) / post.length)
  : 0;

const lossImprovement = preLoss > 0
  ? Math.round(((preLoss - postLoss) / preLoss) * 100)
  : 0;

// =======================
// PROBLEMS
// =======================

const problems = closed.filter(c =>
    (c.final_minutes && c.final_minutes > avgSetup * 1.5) ||
    (c.bucket_loss && c.bucket_loss > avgBucket * 1.5)
);

// =======================
// PERFORMANCE STATUS
// =======================

const performanceStatus = closed.length > 0
    ? avgSetup < 60 ? "🟢 Good"
    : avgSetup < 120 ? "🟡 Moderate"
    : "🔴 Needs Improvement"
    : "-";

// =======================
// RENDER
// =======================

res.render('dashboard',{
    planned,
    active,
    closed,
    problems,
    total: rows.length,
    avgSetup,
    avgBucket,
    performanceStatus,
    bestCO,
    worstCO,
    topLossStyle,
    topLossValue,
    preAvg,
    postAvg,
    improvement,
    preLoss,
    postLoss,
    lossImprovement
});

} catch(err){
console.log(err);
res.send("Database error");
}

});
    // =====================
    // AVERAGES (THIS WAS MISSING)
    // =====================
    let avgSetup = 0;
    let avgBucket = 0;

    // =====================
    // PAST CHANGEOVERS
    // =====================

app.get('/past-changeovers', async (req,res)=>{

try {

const result = await pool.query("SELECT * FROM changeovers ORDER BY id DESC");
const rows = result.rows;

rows.forEach(co=>{
    co.line = formatLine(co.line);
});

res.render('past-changeovers',{ changeovers:rows });

} catch(err){
    console.log(err);
    res.send("Database error");
}

});
    // =====================
    // START CHANGEOVER
    // =====================

app.post('/start-changeover/:id', async (req, res) => {

  const id = req.params.id;

  try {

    await pool.query(
      `UPDATE changeovers 
       SET status = 'in_progress', 
           start_time = NOW()
       WHERE id = $1`,
      [id]
    );

    console.log("✅ Changeover started:", id);

    res.redirect('/active-changeover/' + id);

  } catch (err) {
    console.log("❌ START ERROR:", err);
    res.redirect('/dashboard');
  }

});

    // =====================
    // STOP CHANGEOVER (FIXED)
    // =====================

   app.post('/stop/:id', async (req, res) => {

  const id = req.params.id;

  try {

    const result = await pool.query(
      "SELECT start_time, deduction_minutes FROM changeovers WHERE id = $1",
      [id]
    );

    const row = result.rows[0];

    if (!row) return res.send("No data");

    const startTime = new Date(row.start_time).getTime();
    const endTime = Date.now();

    const duration = Math.floor((endTime - startTime) / 60000);
    const deduction = row.deduction_minutes || 0;
    const final = Math.max(0, duration - deduction);

    await pool.query(`
      UPDATE changeovers
      SET status='closed',
          end_time = NOW(),
          duration_minutes=$1,
          final_minutes=$2
      WHERE id=$3
    `, [duration, final, id]);

    res.redirect(`/post-changeover/${id}`);

  } catch (err) {
    console.log(err);
    res.redirect('/dashboard');
  }

});
 
// =====================
    // ACTIVE PAGE
    // =====================

app.get('/active-changeover/:id', async (req, res) => {

    const id = req.params.id;

    try {

        const result = await pool.query(
            "SELECT * FROM changeovers WHERE id = $1",
            [id]
        );

        const changeover = result.rows[0];

        if (!changeover) {
            console.log("❌ No changeover found");
            return res.redirect('/dashboard');
        }

        if (!changeover.start_time) {
            console.log("⚠️ Missing start_time");
            return res.redirect('/dashboard');
        }

        res.render('active-changeover', {
            changeover,
            pendingCount: 0
        });

    } catch (err) {
        console.log("❌ ACTIVE PAGE ERROR:", err);
        res.redirect('/dashboard');
    }

});

    // =====================
    // POST CHANGEOVER PAGE
    // =====================

 app.get('/post-changeover/:id', async (req, res) => {

  const id = req.params.id;

  try {
    const result = await pool.query(
      "SELECT * FROM changeovers WHERE id = $1",
      [id]
    );

    const row = result.rows[0];

    res.render('post-changeover', { changeover: row });

  } catch (err) {
    console.log(err);
    res.redirect('/dashboard');
  }

});

    // =====================
    // SAVE POST ANALYSIS
    // =====================

app.post('/post-changeover/:id', async (req, res) => {

  const id = req.params.id;

  let { ramp_up_days, bucket_loss, major_delay } = req.body;

  // 🔥 SAFE CONVERSION (handles "", undefined, NaN)
  ramp_up_days = ramp_up_days ? parseInt(ramp_up_days) : null;
  bucket_loss = bucket_loss ? parseInt(bucket_loss) : null;

  try {

    await pool.query(`
      UPDATE changeovers
      SET ramp_up_days = $1,
          bucket_loss = $2,
          major_delay = $3
      WHERE id = $4
    `, [
      isNaN(ramp_up_days) ? null : ramp_up_days,
      isNaN(bucket_loss) ? null : bucket_loss,
      major_delay || null,
      id
    ]);

    res.redirect('/dashboard');

  } catch (err) {
    console.log("❌ POST ANALYSIS ERROR:", err);
    res.send("Error saving analysis"); // 👈 IMPORTANT for debugging
  }

});
    // =====================
    // DELETE
    // =====================

app.post('/delete/:id', async (req, res) => {

  const id = req.params.id;

  try {
    await pool.query("DELETE FROM changeovers WHERE id = $1", [id]);
    res.redirect('/dashboard');
  } catch (err) {
    console.log(err);
    res.redirect('/dashboard');
  }

});

    // =====================
    // REPORTS
    // =====================

  // =====================
// REPORTS
// =====================

app.get('/reports', async (req, res) => {

  try {
    const result = await pool.query(
      "SELECT * FROM changeovers WHERE status='closed'"
    );

    const rows = result.rows;

    rows.forEach(co => {
      co.line = formatLine(co.line);
    });

    res.render('reports', { changeovers: rows });

  } catch (err) {
    console.log(err);
    res.redirect('/dashboard');
  }

});


// =====================
// FIX LINE FORMAT TOOL (optional)
// =====================

app.get('/test123', async (req, res) => {

  try {
    const result = await pool.query("SELECT id, line FROM changeovers");

    const rows = result.rows;

    for (const co of rows) {

      let line = co.line;

      if (line && typeof line === "string" && line.includes("-")) {

        const parts = line.split("-");

        if (parts.length === 2) {

          const day = parseInt(parts[0]);

          const months = {
            Jan: 1, Feb: 2, Mar: 3, Apr: 4,
            May: 5, Jun: 6, Jul: 7, Aug: 8,
            Sep: 9, Oct: 10, Nov: 11, Dec: 12
          };

          const month = months[parts[1]];

          if (month) {

            const fixed = `${day}/${month}`;

            await pool.query(
              "UPDATE changeovers SET line=$1 WHERE id=$2",
              [fixed, co.id]
            );

          }
        }
      }
    }

    res.send("ALL LINES FIXED");

  } catch (err) {
    console.log(err);
    res.send("Error fixing lines");
  }

});

    // =====================
    // PENDING ANALYSIS
    // =====================

app.get('/pending-analysis', async (req, res) => {

  try {
    const result = await pool.query(`
      SELECT * FROM changeovers
      WHERE status='closed'
      AND (ramp_up_days IS NULL OR ramp_up_days = 0)
      ORDER BY id DESC
    `);

    const rows = result.rows;

    res.render('pending-analysis', {
      changeovers: rows
    });

  } catch (err) {
    console.log("❌ PENDING ANALYSIS ERROR:", err);
    res.redirect('/dashboard');
  }

});

    // =====================
    // READINESS CHECKLIST
    // =====================

app.get('/readiness-checklist/:id', async (req, res) => {

  try {
    const result = await pool.query(
      "SELECT * FROM changeovers WHERE id = $1",
      [req.params.id]
    );

    const changeover = result.rows[0];

    if (!changeover) {
      return res.send("Changeover not found");
    }

    res.render('readiness-checklist', { changeover });

  } catch (err) {
    console.log(err);
    res.send("Error loading checklist");
  }

});
    // =====================
    // SAVE READINESS
    // =====================

  app.post('/save-readiness/:id', async (req, res) => {

  const id = req.params.id;
  const d = req.body;

  try {

    await pool.query(`
      UPDATE changeovers SET
        fabric_ready=$1,
        panels_ready=$2,
        thread_ready=$3,
        trims_ready=$4,
        labels_ready=$5,
        attachments_ready=$6,
        needle_ready=$7,
        presser_ready=$8,
        bobbins_ready=$9,
        techpack_ready=$10,
        operation_ready=$11,
        sample_ready=$12,
        quality_ready=$13,
        operators_ready=$14,
        workstation_ready=$15,
        line_balance_ready=$16
      WHERE id=$17
    `, [
      d.fabric_ready ? 1 : 0,
      d.panels_ready ? 1 : 0,
      d.thread_ready ? 1 : 0,
      d.trims_ready ? 1 : 0,
      d.labels_ready ? 1 : 0,
      d.attachments_ready ? 1 : 0,
      d.needle_ready ? 1 : 0,
      d.presser_ready ? 1 : 0,
      d.bobbins_ready ? 1 : 0,
      d.techpack_ready ? 1 : 0,
      d.operation_ready ? 1 : 0,
      d.sample_ready ? 1 : 0,
      d.quality_ready ? 1 : 0,
      d.operators_ready ? 1 : 0,
      d.workstation_ready ? 1 : 0,
      d.line_balance_ready ? 1 : 0,
      id
    ]);

    res.redirect('/readiness-checklist/' + id);

  } catch (err) {
    console.log(err);
    res.send("Error saving readiness");
  }

});

    // =====================
    // SERVER
    // =====================

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });