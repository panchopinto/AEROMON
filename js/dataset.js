import { CONFIG } from './config.js';

const els = {
  table: document.getElementById('table'),
  rowsCount: document.getElementById('rowsCount'),
};

async function load(){
  return new Promise((resolve,reject)=>{
    Papa.parse(CONFIG.CSV_URL, {
      download: true, header: true, dynamicTyping: false,
      complete: (res)=> resolve(res),
      error: (err)=> reject(err)
    });
  });
}

function renderTable(data){
  if(!data || !data.length){ document.getElementById('table').innerHTML = "<caption>Sin datos</caption>"; return; }
  const headers = Object.keys(data[0]);
  let html = "<thead><tr>" + headers.map(h=>`<th>${h}</th>`).join("") + "</tr></thead><tbody>";
  for(const row of data){
    html += "<tr>" + headers.map(h=>`<td>${row[h]??""}</td>`).join("") + "</tr>";
  }
  html += "</tbody>";
  document.getElementById('table').innerHTML = html;
  document.getElementById('rowsCount').textContent = data.length;
}

async function refresh(){
  try{
    const res = await load();
    renderTable(res.data);
  }catch(e){
    console.error(e);
    document.getElementById('table').innerHTML = "<caption>Error al leer CSV (¿ID/GID correctos?)</caption>";
  }
}

document.addEventListener('click', (ev)=>{
  if((ev.target.closest('button')||{}).id==='btnReload'){ refresh(); }
});
refresh();
