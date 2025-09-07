import { CONFIG } from './config.js';
const els = {
  statTemp: document.getElementById('stat-temp'),
  statHum: document.getElementById('stat-hum'),
  statWater: document.getElementById('stat-water'),
  statTime: document.getElementById('stat-time'),
  lastErr: document.getElementById('lastError'),
  canvas: document.getElementById('chart'),
};
let chart, rawRows=[], hourlyRows=[], headers=[], numericCols=[];
let mode = 'hour';

function parseDateSmart(x){
  if(!x) return null;
  let d = new Date(x);
  if(!isNaN(d)) return d;
  const m = String(x).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if(m){
    const [_, dd, mm, yyyy, HH='0', MM='0', SS='0'] = m;
    const y = (+yyyy<100)? (2000+ +yyyy) : +yyyy;
    return new Date(y, +mm-1, +dd, +HH, +MM, +SS);
  }
  if(!isNaN(+x)){
    const excelEpoch = new Date(Date.UTC(1899,11,30));
    const ms = (+x)*86400000;
    return new Date(excelEpoch.getTime()+ms);
  }
  return null;
}

function detectColumns(rows){
  headers = rows[0];
  let tsIdx = headers.findIndex(h => /fecha|time|timestamp|hora/i.test(h));
  if(tsIdx === -1) tsIdx = 0;
  numericCols = headers.map((h,i)=>({h,i})).filter(o=>o.i!==tsIdx).filter(o=>{
    for(let r=1;r<Math.min(rows.length, 20);r++){
      const v = rows[r][o.i];
      const n = parseFloat(String(v).replace(',','.'));
      if(!isFinite(n)) return false;
    }
    return true;
  }).slice(0,3);
  return { tsIdx };
}

function toObjects(rows, tsIdx){
  const out = [];
  for(let r=1;r<rows.length;r++){
    const obj = {};
    const ts = parseDateSmart(rows[r][tsIdx]);
    if(!ts) continue;
    obj.timestamp = ts;
    for(const {h,i} of numericCols){
      const n = parseFloat(String(rows[r][i]).replace(',','.'));
      obj[h] = isFinite(n)? n : null;
    }
    out.push(obj);
  }
  out.sort((a,b)=>a.timestamp - b.timestamp);
  return out;
}

function aggregateHourly(objs){
  if(!objs.length) return [];
  const buckets = new Map();
  for(const row of objs){
    const d = new Date(row.timestamp);
    d.setMinutes(0,0,0);
    const key = d.getTime();
    if(!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const result = [];
  for(const [key, list] of [...buckets.entries()].sort((a,b)=>a[0]-b[0])){
    const item = { timestamp: new Date(+key) };
    for(const {h} of numericCols){
      const vals = list.map(o=>o[h]).filter(v=>v!=null && isFinite(v));
      item[h] = vals.length? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    }
    result.push(item);
  }
  return result;
}

function fmt(n, unit=""){
  if(n==null || !isFinite(n)) return "—";
  const s = (Math.round(n*10)/10).toFixed(1);
  return unit ? `${s}${unit}` : s;
}

function updateStats(objs){
  const last = objs[objs.length-1];
  if(!last){
    els.statTime.querySelector('.value').textContent = "No hay datos";
    return;
  }
  const prev = objs[objs.length-2] || null;
  const findH = (re, def=null)=> (numericCols.find(c=>re.test(c.h))?.h || def);
  const tempKey = findH(/ambiente|temp(?!.*agua)|^t(?!.*agua)/i, numericCols[0]?.h);
  const humKey  = findH(/hum/i, null);
  const waterKey= findH(/agua|water/i, null);

  if(tempKey){
    els.statTemp.querySelector('.value').textContent = fmt(last[tempKey], "°C");
    els.statTemp.querySelector('.delta').textContent = prev? `→ desde ${fmt(prev[tempKey], "°C")}` : "—";
  }
  if(humKey){
    els.statHum.querySelector('.value').textContent = fmt(last[humKey], "%");
    els.statHum.querySelector('.delta').textContent = prev? `→ desde ${fmt(prev[humKey], "%")}` : "—";
  }
  if(waterKey){
    els.statWater.querySelector('.value').textContent = fmt(last[waterKey], "°C");
    els.statWater.querySelector('.delta').textContent = prev? `→ desde ${fmt(prev[waterKey], "°C")}` : "—";
  }
  els.statTime.querySelector('.value').textContent = new Date(last.timestamp).toLocaleString();
}

function buildChart(objs){
  const labels = objs.map(o=>o.timestamp);
  const datasets = numericCols.map(({h})=> ({
    label: h,
    data: objs.map(o=> (o[h] ?? null)),
    spanGaps: true,
    pointRadius: 0,
    borderWidth: 2,
    tension: .24,
  }));
  const cfg = {
    type:'line',
    data:{ labels, datasets },
    options:{
      parsing:false,
      scales:{
        x:{ type:'time', time:{ unit: (mode==='hour'?'hour':'minute') } },
        y:{ beginAtZero:false }
      },
      plugins:{
        legend:{ display:true },
        tooltip:{ mode:'index', intersect:false }
      }
    }
  };
  if(chart){ chart.destroy(); }
  chart = new Chart(els.canvas, cfg);
}

function setBtns(){
  document.getElementById('modeHour').classList.toggle('on', mode==='hour');
  document.getElementById('modeRaw').classList.toggle('on', mode==='raw');
}

async function load(){
  els.lastErr.textContent = "";
  return new Promise((resolve,reject)=>{
    Papa.parse(CONFIG.CSV_URL, {
      download: true, header: true, dynamicTyping: false,
      complete: (res)=> resolve(res),
      error: (err)=> reject(err)
    });
  });
}

async function refresh(){
  try{
    const res = await load();
    if(!res || !res.data || !res.data.length) throw new Error("CSV vacío");
    const rows = [Object.keys(res.data[0])].concat(res.data.map(r=>Object.values(r)));
    const { tsIdx } = detectColumns(rows);
    const objs = toObjects(rows, tsIdx);
    rawRows = objs;
    hourlyRows = aggregateHourly(objs);
    const use = (mode==='hour')? hourlyRows : rawRows;
    updateStats(use);
    buildChart(use);
  }catch(e){
    console.error(e);
    els.lastErr.textContent = "No se pudo leer datos (404/CSV)";
    els.statTime.querySelector('.value').textContent = "Error de lectura";
  }
}

document.addEventListener('click', (ev)=>{
  const id = (ev.target.closest('button, a')||{}).id || "";
  if(id==='modeHour'){ mode='hour'; setBtns(); buildChart(hourlyRows); }
  if(id==='modeRaw'){ mode='raw'; setBtns(); buildChart(rawRows); }
  if(id==='btnReload'){ refresh(); }
});

setBtns();
refresh();
