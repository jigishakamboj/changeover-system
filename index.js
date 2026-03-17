const db = require('./database/database.js');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const USERNAME = "admin";
const PASSWORD = "1234";

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
// NEW CHANGEOVER PAGE
// =====================

app.get('/new-changeover',(req,res)=>{
res.render('new-changeover');
});

// =====================
// SAVE NEW CHANGEOVER
// =====================

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

const total = rows.length;

const planned = rows.filter(r=>r.status==='planned');
const active = rows.filter(r=>r.status==='in_progress');
const closed = rows.filter(r=>r.status==='closed');

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

if(co.ramp_up_days==1){
co.ramp_status="🟢 Stable";
}
else if(co.ramp_up_days==2){
co.ramp_status="🟡 Moderate";
}
else if(co.ramp_up_days>=3){
co.ramp_status="🔴 Slow";
}
else{
co.ramp_status="-";
}

});

// AVERAGES

const avgSetup =
closed.length>0
?Math.round(closed.reduce((s,c)=>s+(c.final_minutes||0),0)/closed.length)
:0;

const avgBucket =
closed.length>0
?Math.round(closed.reduce((s,c)=>s+(c.bucket_loss||0),0)/closed.length)
:0;

// PERFORMANCE STATUS

let performanceStatus="No Data";

if(closed.length>0){

if(avgSetup<=40 && avgBucket<=150){
performanceStatus="🟢 GOOD";
}
else if(avgSetup<=60){
performanceStatus="🟡 AVERAGE";
}
else{
performanceStatus="🔴 NEEDS IMPROVEMENT";
}

}

// TOP LOSS STYLE

let topLossStyle="-";
let topLossValue=0;

if(closed.length>0){

const worstLoss = closed.reduce((max,co)=>
(co.bucket_loss||0)>(max.bucket_loss||0)?co:max
);

topLossStyle = worstLoss.from_style+" → "+worstLoss.to_style;
topLossValue = worstLoss.bucket_loss||0;

}

// PROBLEM CHANGEOVERS

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
total,
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

if(err){
console.log(err);
}

res.render('past-changeovers',{ changeovers:rows });

});

});

// =====================
// START CHANGEOVER
// =====================

app.post('/start/:id',(req,res)=>{

const id=req.params.id;
const startTime=new Date().toISOString();

db.run(`
UPDATE changeovers
SET status='in_progress',
start_time=?
WHERE id=?`,
[startTime,id],
(err)=>{

if(err){
console.log(err);
}

res.redirect(`/active-changeover/${id}`);

});

});

// =====================
// STOP CHANGEOVER
// =====================

app.post('/stop/:id',(req,res)=>{

const id=req.params.id;
const endTime=new Date().toISOString();

db.get(
"SELECT start_time,deduction_minutes FROM changeovers WHERE id=?",
[id],
(err,row)=>{

if(err || !row || !row.start_time){
return res.redirect('/dashboard');
}

const start=new Date(row.start_time);
const end=new Date(endTime);

const duration=Math.floor((end-start)/60000);
const final=duration-(row.deduction_minutes||0);

db.run(`
UPDATE changeovers
SET status='closed',
end_time=?,
duration_minutes=?,
final_minutes=?
WHERE id=?`,
[endTime,duration,final,id],
(err)=>{

if(err){
console.log(err);
}

res.redirect(`/post-changeover/${id}`);

});

});

});

// =====================
// ACTIVE PAGE
// =====================

app.get('/active-changeover/:id',(req,res)=>{

const id=req.params.id;

db.get(
"SELECT * FROM changeovers WHERE id=?",
[id],
(err,row)=>{

if(err){
console.log(err);
}

res.render('active-changeover',{ changeover:row });

});

});

// =====================
// POST CHANGEOVER PAGE
// =====================

app.get('/post-changeover/:id',(req,res)=>{

const id=req.params.id;

db.get(
"SELECT * FROM changeovers WHERE id=?",
[id],
(err,row)=>{

if(err){
console.log(err);
}

res.render('post-changeover',{ changeover:row });

});

});

// =====================
// SAVE POST ANALYSIS
// =====================

app.post('/post-changeover/:id',(req,res)=>{

const id=req.params.id;
const {ramp_up_days,bucket_loss,major_delay}=req.body;

db.run(`
UPDATE changeovers
SET ramp_up_days=?,
bucket_loss=?,
major_delay=?
WHERE id=?`,
[ramp_up_days,bucket_loss,major_delay,id],
(err)=>{

if(err){
console.log(err);
}

res.redirect('/dashboard');

});

});

// =====================
// DELETE
// =====================

app.post('/delete/:id',(req,res)=>{

const id=req.params.id;

db.run("DELETE FROM changeovers WHERE id=?",[id],(err)=>{

if(err){
console.log(err);
}

res.redirect('/dashboard');

});

});

// =====================
// REPORTS
// =====================

app.get('/reports',(req,res)=>{

db.all(
"SELECT * FROM changeovers WHERE status='closed'",
(err,rows)=>{

if(err){
console.log(err);
}

res.render('reports',{ changeovers:rows });

});

});

// =====================
// PENDING ANALYSIS
// =====================

app.get('/pending-analysis',(req,res)=>{

db.all(`
SELECT * FROM changeovers
WHERE status='closed'
AND (ramp_up_days IS NULL OR ramp_up_days='')
`,
(err,rows)=>{

if(err){
console.log(err);
return res.redirect('/dashboard');
}

res.render('pending-analysis',{ changeovers:rows });

});

});

// =====================
// READINESS CHECKLIST
// =====================

app.get('/readiness-checklist/:id',(req,res)=>{

const id=req.params.id;

db.get(
"SELECT * FROM changeovers WHERE id=?",
[id],
(err,row)=>{

res.render('readiness-checklist',{ changeover:row });

});

});

// =====================
// SAVE READINESS
// =====================

app.post('/save-readiness/:id',(req,res)=>{

const id=req.params.id;
const d=req.body;

db.run(`
UPDATE changeovers SET
fabric_ready=?,
panels_ready=?,
thread_ready=?,
trims_ready=?,
labels_ready=?,
attachments_ready=?,
needle_ready=?,
presser_ready=?,
bobbins_ready=?,
techpack_ready=?,
operation_ready=?,
sample_ready=?,
quality_ready=?,
operators_ready=?,
workstation_ready=?,
line_balance_ready=?
WHERE id=?`,
[
d.fabric_ready?1:0,
d.panels_ready?1:0,
d.thread_ready?1:0,
d.trims_ready?1:0,
d.labels_ready?1:0,
d.attachments_ready?1:0,
d.needle_ready?1:0,
d.presser_ready?1:0,
d.bobbins_ready?1:0,
d.techpack_ready?1:0,
d.operation_ready?1:0,
d.sample_ready?1:0,
d.quality_ready?1:0,
d.operators_ready?1:0,
d.workstation_ready?1:0,
d.line_balance_ready?1:0,
id
],
(err)=>{

if(err){
console.log(err);
}

res.redirect('/readiness-checklist/'+id);

});

});

// =====================
// SERVER
// =====================

app.listen(PORT,()=>{
console.log(`Server running on http://localhost:${PORT}`);
});
