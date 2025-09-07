// js/config.js
// URL de CSV (Google Sheets): usa export directo con gid correcto.
export const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTsFq3I7ieNuPoPqH7Pl732_AMhYcaF1R1EMbGz4ZWwNAcxOBDTqjiWrrP8GFUGDYOXSHEjfEtMjUKN/pub?gid=0&single=true&output=csv";

// Columnas esperadas en la hoja (encabezados exactos). Ajusta si tu hoja difiere.
export const COLUMNS = {
  fecha: "Fecha",
  temperatura: "Temperatura",
  humedad: "Humedad"
};

// Auto refresh (ms)
export const REFRESH_MS = 60000;
