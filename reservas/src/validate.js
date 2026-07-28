import {
  TIMEZONE,
  OPENING_HOURS,
  MAX_PARTY_SIZE,
  MAX_DAYS_AHEAD,
  MIN_MINUTES_NOTICE,
} from './config.js';

/** 'HH:MM' -> minutos desde medianoche. */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Fecha y hora actuales en el huso del restaurante, no en UTC. */
export function nowInTimezone(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type).value;
  const hour = get('hour') === '24' ? '00' : get('hour');

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: toMinutes(`${hour}:${get('minute')}`),
  };
}

/** Día de la semana de 'YYYY-MM-DD' (0 = domingo), sin desplazamiento de huso. */
function dayOfWeek(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDays(isoDate, delta) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function daysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/**
 * ¿Está el restaurante abierto ese día a esa hora?
 *
 * Los jueves, viernes y sábados cierran a la 1:00, así que una petición para
 * "viernes 00:30" cae en realidad en el servicio de la noche del jueves. Se
 * comprueban las dos posibilidades: la tarde del propio día y la madrugada
 * heredada del día anterior.
 */
export function isOpenAt(isoDate, hhmm) {
  const minutes = toMinutes(hhmm);

  const sameDay = OPENING_HOURS[dayOfWeek(isoDate)];
  if (sameDay) {
    const open = toMinutes(sameDay.open);
    const close = toMinutes(sameDay.close);
    const spansMidnight = close <= open;
    if (spansMidnight ? minutes >= open : minutes >= open && minutes < close) {
      return true;
    }
  }

  const prev = OPENING_HOURS[dayOfWeek(addDays(isoDate, -1))];
  if (prev) {
    const open = toMinutes(prev.open);
    const close = toMinutes(prev.close);
    if (close <= open && minutes < close) return true;
  }

  return false;
}

/** Texto legible del horario, para el mensaje de error. */
export function humanHours() {
  const names = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return Object.entries(OPENING_HOURS)
    .map(([dow, h]) => `${names[dow]} ${h.open}–${h.close}`)
    .join(', ');
}

function normalisePhone(raw) {
  const digits = String(raw).replace(/[\s.\-()]/g, '');
  const match = digits.match(/^(?:\+34|0034|34)?([679]\d{8})$/);
  return match ? match[1] : null;
}

/**
 * Google Sheets interpreta como fórmula cualquier celda que empiece por = + - @.
 * Se escribe con valueInputOption=RAW, que ya lo evita, pero se antepone un
 * apóstrofo por si algún día alguien cambia ese parámetro.
 */
export function sanitiseCell(value) {
  const text = String(value ?? '').slice(0, 500);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/**
 * Valida y normaliza el cuerpo de la petición.
 * Devuelve { ok: true, data } o { ok: false, errors: { campo: mensaje } }.
 */
export function validateReservation(body, now = new Date()) {
  const errors = {};
  const data = {};

  const nombre = String(body?.nombre ?? '').trim();
  if (nombre.length < 2) errors.nombre = 'Indica tu nombre.';
  else if (nombre.length > 80) errors.nombre = 'El nombre es demasiado largo.';
  else data.nombre = nombre;

  const telefono = normalisePhone(body?.telefono ?? '');
  if (!telefono) errors.telefono = 'Indica un teléfono español válido (9 dígitos).';
  else data.telefono = telefono;

  // El email es opcional: sin él la confirmación va solo por teléfono.
  const email = String(body?.email ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'Ese email no parece válido.';
  } else {
    data.email = email;
  }

  const comensales = Number(body?.comensales);
  if (!Number.isInteger(comensales) || comensales < 1) {
    errors.comensales = 'Indica cuántos sois.';
  } else if (comensales > MAX_PARTY_SIZE) {
    errors.comensales = `Para grupos de más de ${MAX_PARTY_SIZE} personas, llámanos y lo organizamos.`;
  } else {
    data.comensales = comensales;
  }

  const fecha = String(body?.fecha ?? '').trim();
  const hora = String(body?.hora ?? '').trim();
  const fechaOk = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const horaOk = /^\d{2}:\d{2}$/.test(hora);

  if (!fechaOk) errors.fecha = 'Indica la fecha.';
  if (!horaOk) errors.hora = 'Indica la hora.';

  if (fechaOk && horaOk) {
    const current = nowInTimezone(now);
    const dayDelta = daysBetween(current.date, fecha);

    if (dayDelta < 0) {
      errors.fecha = 'Esa fecha ya ha pasado.';
    } else if (dayDelta > MAX_DAYS_AHEAD) {
      errors.fecha = `Solo aceptamos reservas con ${MAX_DAYS_AHEAD} días de antelación.`;
    } else if (!isOpenAt(fecha, hora)) {
      errors.hora = `Ese día no abrimos a esa hora. Horario: ${humanHours()}.`;
    } else if (dayDelta === 0 && toMinutes(hora) - current.minutes < MIN_MINUTES_NOTICE) {
      errors.hora = `Para hoy necesitamos al menos ${MIN_MINUTES_NOTICE} minutos de margen. Mejor llámanos.`;
    } else {
      data.fecha = fecha;
      data.hora = hora;
    }
  }

  const peticion = String(body?.peticion ?? '').trim();
  if (peticion.length > 500) errors.peticion = 'La petición es demasiado larga.';
  else data.peticion = peticion;

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
