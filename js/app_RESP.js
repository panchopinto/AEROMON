/* Lógica del Panel: lee CSV publicado y grafica */
(async function(){
  const wait = (ms)=> new Promise(r=>setTimeout(r,ms));
  const $ = (sel)=> document.querySelector(sel);
  const tbody = $('#tbl tbody');
  const tempNow = $('#tempNow');
  const humNow  = $('#humNow');
  const lastTime= $('#lastTime');
  const tempTrend = $('#tempTrend');
  const humTrend  = $('#humTrend');
  const btnReload = $('#btnReload');
  if(btnReload) btnReload.addEventListener('click', ()=> location.reload());

  if(!SHEET_CSV_URL){
    lastTime.textContent = 'Configura SHEET_CSV_URL';
    return;
  }

  const parseCSV = (csv) => new Promise((resolve)=>{
    Papa.parse(csv, { header:false, dynamicTyping:true, complete: resolve });
  });

  try{
    const res = await fetch(SHEET_CSV_URL, {cache:'no-store'});
    const text = await res.text();
    const parsed = await parseCSV(text);
    // Se asume schema: [fecha, temp, hum, ip]
    let rows = parsed.data.filter(r=> r && r.length >= 3 && r[0] !== "");

    // Ordenar por fecha ascendente si vinieran desordenados
    rows = rows.map(r=>{
      const fecha = new Date(r[0]);
      return [fecha, Number(r[1]), Number(r[2]), r[3] || ""];
    }).filter(r=> !isNaN(r[0].getTime()) && !isNaN(r[1]) && !isNaN(r[2]));

    rows.sort((a,b)=> a[0]-b[0]);

    // Limitar a los últimos N
    const recent = rows.slice(-ROW_LIMIT);

    // Pintar tabla (invertida: más nuevo arriba)
    tbody.innerHTML = "";
    [...recent].reverse().forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r[0].toLocaleString()}</td><td>${r[1].toFixed(1)}</td><td>${r[2].toFixed(0)}</td><td>${r[3]}</td>`;
      tbody.appendChild(tr);
    });

    // Métricas instantáneas
    const last = recent[recent.length-1];
    if(last){
      tempNow.textContent = `${last[1].toFixed(1)}`;
      humNow.textContent  = `${last[2].toFixed(0)}`;
      lastTime.textContent= last[0].toLocaleString();

      // Tendencias simples
      if(recent.length > 3){
        const t0 = recent[0][1], t1 = last[1];
        const h0 = recent[0][2], h1 = last[2];
        tempTrend.textContent = (t1>t0? "↗︎": t1<t0? "↘︎":"→") + ` desde ${t0.toFixed(1)}°C`;
        humTrend.textContent  = (h1>h0? "↗︎": h1<h0? "↘︎":"→") + ` desde ${h0.toFixed(0)}%`;
      }
    }

    // Gráfico
    const ctx = document.getElementById('lineChart');
    const labels = recent.map(r=> r[0].toLocaleTimeString());
    const temps  = recent.map(r=> r[1]);
    const hums   = recent.map(r=> r[2]);
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label:'Temperatura (°C)', data: temps },
          { label:'Humedad (%)', data: hums },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins:{ legend:{ display:true } },
        scales: { x:{ grid:{ display:false }}, y:{ beginAtZero:false } }
      }
    });

  }catch(err){
    console.error(err);
    lastTime.textContent = 'Error leyendo CSV';
  }
})();
