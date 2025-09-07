/* Panel: soporta CSV publicado o GViz CSV, con cache-busting y límite + mejoras UI */
(async function(){
  const $ = (sel)=> document.querySelector(sel);
  const tbody = $('#tbl tbody');
  const tempNow = $('#tempNow');
  const humNow  = $('#humNow');
  const lastTime= $('#lastTime');
  const tempTrend = $('#tempTrend');
  const humTrend  = $('#humTrend');
  const btnReload = $('#btnReload');
  if(btnReload) btnReload.addEventListener('click', ()=> location.reload());

  const parseCSV = (csv) => new Promise((resolve)=>{
    Papa.parse(csv, { header:false, dynamicTyping:true, complete: resolve });
  });

  function buildURL(){
    let u = "";
    if (typeof SHEET_GVIZ_URL === "string" && SHEET_GVIZ_URL) u = SHEET_GVIZ_URL;
    else if (typeof SHEET_CSV_URL === "string" && SHEET_CSV_URL) u = SHEET_CSV_URL;
    return u ? (u + (u.includes("?") ? "&" : "?") + "_cb=" + Date.now()) : "";
  }

  const dataURL = buildURL();
  if(!dataURL){
    if(lastTime) lastTime.textContent = 'Configura SHEET_CSV_URL o SHEET_GVIZ_URL en js/config.js';
    return;
  }

  try{
    const res = await fetch(dataURL, { cache: 'no-store' });
    if(!res.ok){
      if(lastTime) lastTime.textContent = 'No se pudo leer datos (' + res.status + ')';
      return;
    }
    const text = await res.text();
    const parsed = await parseCSV(text);
    let rows = parsed.data.filter(r=> r && r.length >= 3 && r[0] !== "");

    rows = rows.map(r=>{
      const dt = new Date(r[0]);
      const t  = Number(r[1]);
      const h  = Number(r[2]);
      const ip = (r[3] || "").toString();
      return [dt, t, h, ip];
    }).filter(r=> !isNaN(r[0].getTime()) && !isNaN(r[1]) && !isNaN(r[2]));

    if (typeof SHEET_CSV_URL === "string" && SHEET_CSV_URL){
      rows.sort((a,b)=> a[0]-b[0]);
      rows = rows.slice(-Math.max(1, ROW_LIMIT|0));
    } else {
      rows.sort((a,b)=> a[0]-b[0]);
    }

    // Tabla (más nuevo arriba)
    if(tbody){
      tbody.innerHTML = "";
      [...rows].reverse().forEach(r=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r[0].toLocaleString()}</td><td>${r[1].toFixed(1)}</td><td>${r[2].toFixed(0)}</td><td>${r[3]}</td>`;
        tbody.appendChild(tr);
      });
    }

    // Métricas + tendencias
    const last = rows[rows.length-1];
    if(last){
      if(tempNow) tempNow.textContent = `${last[1].toFixed(1)}`;
      if(humNow)  humNow.textContent  = `${last[2].toFixed(0)}`;
      if(lastTime)lastTime.textContent= last[0].toLocaleString();

      if(rows.length > 3){
        const t0 = rows[0][1], t1 = last[1];
        const h0 = rows[0][2], h1 = last[2];
        if(tempTrend){
          const tdir = (t1>t0? 'up': t1<t0? 'down':'equal');
          tempTrend.className = 'trend ' + tdir;
          tempTrend.textContent = (t1>t0? "↗︎": t1<t0? "↘︎":"→") + ` desde ${t0.toFixed(1)}°C`;
        }
        if(humTrend){
          const hdir = (h1>h0? 'up': h1<h0? 'down':'equal');
          humTrend.className = 'trend ' + hdir;
          humTrend.textContent  = (h1>h0? "↗︎": h1<h0? "↘︎":"→") + ` desde ${h0.toFixed(0)}%`;
        }
      }
    }

    // Gráfico con límites agradables
    const ctx = document.getElementById('lineChart');
    if(ctx){
      const labels = rows.map(r=> r[0].toLocaleTimeString());
      const temps  = rows.map(r=> r[1]);
      const hums   = rows.map(r=> r[2]);

      const tMin = Math.min(...temps), tMax = Math.max(...temps);
      const hMin = Math.min(...hums),  hMax = Math.max(...hums);
      const globalMin = Math.min(tMin, hMin);
      const globalMax = Math.max(tMax, hMax);
      const pad = (v)=> (isFinite(v)? Math.max(0.5, Math.abs(v)*0.05) : 1);

      new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label:'Temperatura (°C)', data: temps, tension:.35, borderWidth:2, pointRadius:2 },
            { label:'Humedad (%)', data: hums, tension:.35, borderWidth:2, pointRadius:2 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins:{ legend:{ display:true } },
          scales: {
            x:{ grid:{ display:false } },
            y:{
              beginAtZero:false,
              suggestedMin: globalMin - pad(globalMin),
              suggestedMax: globalMax + pad(globalMax),
            }
          }
        }
      });
    }

  }catch(err){
    console.error(err);
    if(lastTime) lastTime.textContent = 'Error leyendo datos';
  }
})();
