// Configuración de Google Sheets / CSV
const DEFAULT_SHEET_ID = "1cUd239eUP5Hj3WJnH3_cS6AOhTzzCG8hqU-ZKvuElDY"; // Hoja del usuario (Hoja1)
const DEFAULT_GID = 0; // Hoja1

export const CONFIG = (()=>{
  const url = new URL(window.location.href);
  const SHEET_ID = url.searchParams.get('sheet') || DEFAULT_SHEET_ID;
  const GID = parseInt(url.searchParams.get('gid') || DEFAULT_GID, 10);
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;
  return { SHEET_ID, GID, CSV_URL };
})();
