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
            unit: 'minute',
            tooltipFormat: 'yyyy-MM-dd HH:mm:ss'
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
    const { labels, T, H } = toSeries(rows);
    const ctx = document.getElementById('historyChart').getContext('2d');
    ensureChart(ctx, labels, T, H);
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
