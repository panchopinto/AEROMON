// Redirige si no se encuentra un token simple de acceso (opcional)
document.addEventListener('DOMContentLoaded', ()=>{
  const ok = localStorage.getItem('auth') === 'ok';
  // if(!ok){ location.href = 'index.html'; }
});
