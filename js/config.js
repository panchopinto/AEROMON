// js/config.js
// URL de CSV (Google Sheets): usa export directo con gid correcto.
export const CSV_URL = "https://docs.google.com/spreadsheets/d/1cUd239eUP5Hj3WJnH3_cS6AOhTzzCG8hqU-ZKvuElDY/export?format=csv&gid=0";

// Columnas esperadas en la hoja (encabezados exactos). Ajusta si tu hoja difiere.
export const COLUMNS = {
  fecha: "Fecha",
  temperatura: "Temperatura",
  humedad: "Humedad"
};

// Auto refresh (ms)
export const REFRESH_MS = 60000;
