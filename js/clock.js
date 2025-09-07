// js/clock.js
// Reloj simple en zona local
function updateClock(){
  const now = new Date();
  const santiago = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'full',
    timeStyle: 'medium'
  }).format(now);
  const el = document.getElementById('clock');
  if(el) el.textContent = santiago;
}
setInterval(updateClock, 1000);
updateClock();
