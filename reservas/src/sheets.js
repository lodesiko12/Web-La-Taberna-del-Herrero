import { getAccessToken } from './google-auth.js';
import {
  SHEET_NAME,
  SHEET_HEADERS,
  MAX_COVERS_PER_WINDOW,
  WINDOW_MINUTES,
} from './config.js';
import { toMinutes, sanitiseCell } from './validate.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsFetch(env, path, init = {}) {
  const token = await getAccessToken(env);
  const res = await fetch(`${API}/${env.SHEET_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Comensales ya solicitados para esa fecha en una franja que se solapa.
 *
 * Solo cuentan las filas que no estén canceladas: una reserva anulada libera
 * su sitio.
 */
export async function countCoversInWindow(env, fecha, hora) {
  const range = encodeURIComponent(`${SHEET_NAME}!A2:I`);
  const json = await sheetsFetch(env, `/values/${range}`);
  const rows = json.values ?? [];

  const target = toMinutes(hora);
  let covers = 0;

  for (const row of rows) {
    const [, , estado, , , , rowFecha, rowHora, rowComensales] = row;
    if (rowFecha !== fecha) continue;
    if (String(estado ?? '').toLowerCase().startsWith('cancel')) continue;
    if (!/^\d{2}:\d{2}$/.test(rowHora ?? '')) continue;

    if (Math.abs(toMinutes(rowHora) - target) < WINDOW_MINUTES) {
      covers += Number(rowComensales) || 0;
    }
  }

  return covers;
}

export function hasCapacity(existingCovers, requested) {
  return existingCovers + requested <= MAX_COVERS_PER_WINDOW;
}

/** Crea la pestaña y la fila de cabeceras si el Sheet está vacío. */
export async function ensureHeaders(env) {
  const range = encodeURIComponent(`${SHEET_NAME}!A1:J1`);
  const json = await sheetsFetch(env, `/values/${range}`);

  if (!json.values?.length) {
    await sheetsFetch(env, `/values/${range}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [SHEET_HEADERS] }),
    });
  }
}

export async function appendReservation(env, reservation) {
  const range = encodeURIComponent(`${SHEET_NAME}!A:J`);

  const row = [
    reservation.id,
    reservation.recibida,
    'Pendiente',
    reservation.nombre,
    // Prefijo apóstrofo: si no, Sheets se come el cero inicial de algunos fijos.
    `'${reservation.telefono}`,
    reservation.email,
    reservation.fecha,
    reservation.hora,
    reservation.comensales,
    reservation.peticion,
  ].map(sanitiseCell);

  // RAW impide que Sheets evalúe una celda como fórmula.
  await sheetsFetch(
    env,
    `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [row] }) }
  );
}
