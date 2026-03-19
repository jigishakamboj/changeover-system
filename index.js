const db = require('./database/database.js');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const USERNAME = "admin";
const PASSWORD = "1234";

// =====================
// FIX LINE DISPLAY FORMAT
// =====================

function formatLine(line){
    if(!line) return "";

    if(typeof line === "string" && line.includes("-")){
        const parts = line.split("-");
        if(parts.length === 3){
            return `${parseInt(parts[2])}/${parseInt(parts[1])}`;
        }
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

app.use((req, res, next) => {

db.get(`
SELECT COUNT(*) AS count
FROM changeovers
WHERE status='closed'
AND (ramp_up_days IS NULL OR ramp_up_days = '')
`, (err,row)=>{

if(err){
console.log(err);
res.locals.pendingCount = 0;
}else{
res.locals.pendingCount = row.count;
}

next();

});

});

// =====================
// LOGIN
// =====================

app.get('/', (req,res)=>{
res.render('login');
});

app.post('/login',(req,res)=>{

const {username,password} = req.body;

if(username === USERNAME && password === PASSWORD){
res.redirect('/dashboard');
}else{
res.render('login',{ error:"Invalid username or password"});
}

});

// =====================
// NEW CHANGEOVER
// =====================

app.get('/new-changeover',(req,res)=>{
res.render('new-changeover');
});

app.post('/new-changeover',(req,res)=>{

const {date,line,from_style,to_style,deduction_minutes} = req.body;

db.get("SELECT COUNT(*) as count FROM changeovers",(err,row)=>{

if(err){
console.log(err);
return res.redirect('/dashboard');
}

const nextId = row.count + 1;
const changeoverId = "CO" + String(nextId).padStart(2,"0");

db.run(`
INSERT INTO changeovers
(changeover_id,date,line,from_style,to_style,status,deduction_minutes)
VALUES (?,?,?,?,?,'planned',?)
`,
[
changeoverId,
date,
line,
from_style,
to_style,
deduction_minutes
],
(err)=>{

if(err){
console.log(err);
}

res.redirect('/dashboard');

});

});

});

// =====================
// DASHBOARD
// =====================

app.get('/dashboard',(req,res)=>{

db.all("SELECT * FROM changeovers ORDER BY id DESC",(err,rows)=>{

if(err){
console.log(err);
return res.send("Database error");
}

const planned = rows.filter(r=>r.status==='planned');
const active = rows.filter(r=>r.status==='in_progress');
const closed = rows.filter(r=>r.status==='closed');

// FIX LINE DISPLAY
[...planned, ...active, ...closed].forEach(co=>{
co.line = formatLine(co.line);
});

// READINESS SCORE

planned.forEach(co=>{

const totalChecks = 15;

const completed =
(co.fabric_ready||0)+
(co.panels_ready||0)+
(co.thread_ready||0)+
(co.trims_ready||0)+
(co.labels_ready||0)+
(co.attachments_ready||0)+
(co.needle_ready||0)+
(co.presser_ready||0)+
(co.bobbins_ready||0)+
(co.techpack_ready||0)+
(co.operation_ready||0)+
(co.sample_ready||0)+
(co.quality_ready||0)+
(co.operators_ready||0)+
(co.line_balance_ready||0);

co.readiness = Math.round((completed/totalChecks)*100);

});

// RAMP STATUS

closed.forEach(co=>{

if(co.ramp_up_days==1) co.ramp_status="🟢 Stable";
else if(co.ramp_up_days==2) co.ramp_status="🟡 Moderate";
else if(co.ramp_up_days>=3) co.ramp_status="🔴 Slow";
else co.ramp_status="-";

});

// AVERAGES

const avgSetup = closed.length>0
?Math.round(closed.reduce((s,c)=>s+(c.final_minutes||0),0)/closed.length)
:0;

const avgBucket = closed.length>0
?Math.round(closed.reduce((s,c)=>s+(c.bucket_loss||0),0)/closed.length)
:0;

// PERFORMANCE

let performanceStatus="No Data";

if(closed.length>0){
if(avgSetup<=40 && avgBucket<=150) performanceStatus="🟢 GOOD";
else if(avgSetup<=60) performanceStatus="🟡 AVERAGE";
else performanceStatus="🔴 NEEDS IMPROVEMENT";
}

// TOP LOSS

let topLossStyle="-";
let topLossValue=0;

if(closed.length>0){
const worstLoss = closed.reduce((max,co)=>
(co.bucket_loss||0)>(max.bucket_loss||0)?co:max
);
topLossStyle = worstLoss.from_style+" → "+worstLoss.to_style;
topLossValue = worstLoss.bucket_loss||0;
}

// PROBLEMS

const problems = closed.filter(c =>
(c.final_minutes && c.final_minutes > avgSetup*1.5) ||
(c.bucket_loss && c.bucket_loss > avgBucket*1.5)
);

// BEST / WORST

let bestCO=0;
let worstCO=0;

if(closed.length>0){
bestCO = Math.min(...closed.map(c=>c.final_minutes||0));
worstCO = Math.max(...closed.map(c=>c.final_minutes||0));
}

// RENDER

res.render('dashboard',{
planned,
active,
closed,
problems,
total: rows.length,
avgSetup,
avgBucket,
bestCO,
worstCO,
topLossStyle,
topLossValue,
performanceStatus
});

});

});

// =====================
// PAST CHANGEOVERS
// =====================

app.get('/past-changeovers',(req,res)=>{

db.all("SELECT * FROM changeovers ORDER BY id DESC",(err,rows)=>{

rows.forEach(co=>{
co.line = formatLine(co.line);
});

res.render('past-changeovers',{ changeovers:rows });

});

});

// =====================
// REPORTS
// =====================

app.get('/reports',(req,res)=>{

db.all("SELECT * FROM changeovers WHERE status='closed'",(err,rows)=>{

rows.forEach(co=>{
co.line = formatLine(co.line);
});

res.render('reports',{ changeovers:rows });

});

});

// =====================
// SERVER
// =====================

app.listen(PORT, '0.0.0.0', () => {
console.log(`Server running on port ${PORT}`);
});