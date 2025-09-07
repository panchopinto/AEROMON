// js/app.js
import { CSV_URL, COLUMNS, REFRESH_MS } from './config.js';

let chart;
let timer = null;

const $ = sel => document.querySelector(sel);

async function fetchCSV() {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text;
}

function parseCSVWithPapa(text){
  const out = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (out.errors && out.errors.length){
    console.warn('Papa errors:', out.errors.slice(0,3));
  }
  return out.data;
}

function toSeries(rows){
  // Mapear filas a objetos { t: Date, temp: number, hum: number }
  const T = [];
  const H = [];
  const labels = [];

  for(const r of rows){
    const f = (r[COLUMNS.fecha] || r['Fecha'] || r['fecha'] || '').trim();
    const t = num(r[COLUMNS.temperatura] ?? r['Temperatura'] ?? r['temp']);
    const h = num(r[COLUMNS.humedad] ?? r['Humedad'] ?? r['hum']);

    // Intento robusto de fecha (acepta "YYYY-MM-DD HH:mm:ss" o local)
    const d = parseDate(f);
    if(!isFinite(t) && !isFinite(h)) continue;

    labels.push(isNaN(d.getTime()) ? f : d);
    T.push(isFinite(t) ? t : null);
    H.push(isFinite(h) ? h : null);
  }
  return { labels, T, H };
}

function num(x){
  if (x === undefined || x === null) return NaN;
  const s = String(x).replace(',', '.').replace(/[^0-9.+-]/g,'');
  return parseFloat(s);
}

function parseDate(s){
  // Si viene con formato ISO o similar, Date lo toma; si no, se deja literal en labels.
  const d = new Date(s);
  return d;
}

function updateKPI(rows){
  if(!rows.length) return;

  const last = rows[rows.length - 1];
  const first = rows[0];

  const fecha = last[COLUMNS.fecha] ?? last['Fecha'] ?? last['fecha'] ?? '—';
  const tLast = num(last[COLUMNS.temperatura] ?? last['Temperatura'] ?? last['temp']);
  const hLast = num(last[COLUMNS.humedad] ?? last['Humedad'] ?? last['hum']);
  const tFirst = num(first[COLUMNS.temperatura] ?? first['Temperatura'] ?? first['temp']);
  const hFirst = num(first[COLUMNS.humedad] ?? first['Humedad'] ?? first['hum']);

  $('#last-read').textContent = fecha || '—';
  $('#temp').textContent = isFinite(tLast) ? tLast.toFixed(1) : '—';
  $('#hum').textContent  = isFinite(hLast) ? hLast.toFixed(0) : '—';

  $('#temp-from').textContent = isFinite(tFirst) ? tFirst.toFixed(1) : '—';
  $('#hum-from').textContent  = isFinite(hFirst) ? hFirst.toFixed(0) : '—';
}


function floorToHour(date){
  const d = new Date(date);
  d.setMinutes(0,0,0);
  return d;
}

function formatHourKey(date){
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd} ${hh}:00:00`;
}

function groupByHour(labels, T, H, hoursBack=48){
  const now = new Date();
  const cutoff = new Date(now.getTime() - hoursBack*3600*1000);
  const acc = new Map(); // key => { sumT, nT, sumH, nH, date }

  for(let i=0;i<labels.length;i++){
    const lab = labels[i];
    const d = lab instanceof Date ? lab : new Date(lab);
    if(isNaN(d.getTime())) continue;
    if(d < cutoff) continue;
    const key = formatHourKey(d);
    const hourDate = floorToHour(d);

    const t = T[i];
    const h = H[i];
    if(!acc.has(key)) acc.set(key, { sumT:0, nT:0, sumH:0, nH:0, date: hourDate });

    const obj = acc.get(key);
    if(Number.isFinite(t)){ obj.sumT += t; obj.nT += 1; }
    if(Number.isFinite(h)){ obj.sumH += h; obj.nH += 1; }
  }

  // Sort by date asc
  const entries = Array.from(acc.values()).sort((a,b)=>a.date - b.date);
  const outLabels = [];
  const outT = [];
  const outH = [];

  for(const e of entries){
    outLabels.push(e.date);
    outT.push(e.nT ? e.sumT / e.nT : null);
    outH.push(e.nH ? e.sumH / e.nH : null);
  }
  return { labels: outLabels, T: outT, H: outH };
}
function ensureChart(ctx, labels, T, H){
  if(chart){
    chart.data.labels = labels;
    chart.data.datasets[0].data = T;
    chart.data.datasets[1].data = H;
    chart.update();
    return chart;
  }
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Temperatura (°C)',
          data: T,
          // No fijar colores explícitos (Chart.js asigna automáticamente)
          tension: 0.25,
          pointRadius: 2
        },
        {
          label: 'Humedad (%)',
          data: H,
          tension: 0.25,
          pointRadius: 2,
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour',
            tooltipFormat: 'yyyy-MM-dd HH:00'
          },
          ticks: { autoSkip: true, maxRotation: 0 }
        },
        y: {
          title: { text: '°C', display: true },
          beginAtZero: false
        },
        y2: {
          position: 'right',
          title: { text: '%', display: true },
          beginAtZero: true,
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
  return chart;
}

async function refresh(){
  try{
    $('#status').textContent = 'Cargando…';
    const csv = await fetchCSV();
    const rows = parseCSVWithPapa(csv);
    if(!rows || !rows.length){
      $('#status').textContent = 'CSV vacío.';
      return;
    }
    updateKPI(rows);
    const series = toSeries(rows);
    const grouped = groupByHour(series.labels, series.T, series.H, 48);
    const ctx = document.getElementById('historyChart').getContext('2d');
    ensureChart(ctx, grouped.labels, grouped.T, grouped.H);
    $('#status').textContent = `OK (${new Date().toLocaleTimeString('es-CL')})`;
  }catch(err){
    console.error(err);
    $('#status').textContent = `No se pudo leer datos (${err.message}). Revisa publicación del CSV y gid.`;
  }
}

function startAuto(){
  stopAuto();
  timer = setInterval(refresh, REFRESH_MS);
}
function stopAuto(){
  if(timer){ clearInterval(timer); timer = null; }
}

document.addEventListener('DOMContentLoaded', ()=>{
  refresh();
  startAuto();
  $('#btnRefresh').addEventListener('click', refresh);
  $('#autoToggle').addEventListener('change', (e)=>{
    if(e.target.checked) startAuto(); else stopAuto();
  });
});
