/**
 * Reglas de negocio del restaurante. Es el único archivo que hay que tocar
 * si cambian horarios o aforo.
 */

export const TIMEZONE = 'Europe/Madrid';

/**
 * Horario de apertura por día de la semana (0 = domingo).
 * `close` menor que `open` significa que el cierre es de madrugada.
 * Un día sin entrada está cerrado.
 */
export const OPENING_HOURS = {
  0: { open: '13:30', close: '24:00' }, // domingo
  3: { open: '13:30', close: '23:30' }, // miércoles
  4: { open: '13:30', close: '01:00' }, // jueves
  5: { open: '13:30', close: '01:00' }, // viernes
  6: { open: '13:30', close: '01:00' }, // sábado
};

/** Comensales máximos que se pueden sentar en una misma franja. */
export const MAX_COVERS_PER_WINDOW = 40;

/**
 * Minutos a cada lado de la hora pedida que cuentan como la misma franja.
 * Con 90, una reserva a las 21:00 compite con todas entre 19:30 y 22:30.
 */
export const WINDOW_MINUTES = 90;

/** Una sola reserva no puede pasar de aquí; los grupos grandes van por teléfono. */
export const MAX_PARTY_SIZE = 12;

/** No se aceptan reservas con más de estos días de antelación. */
export const MAX_DAYS_AHEAD = 120;

/** Margen mínimo entre que se pide la mesa y la hora reservada. */
export const MIN_MINUTES_NOTICE = 60;

/** Límite por IP y ventana, para frenar envíos automatizados. */
export const RATE_LIMIT = { maxRequests: 5, windowMinutes: 10 };

/** Pestaña y columnas del Google Sheet. */
export const SHEET_NAME = 'Reservas';
export const SHEET_HEADERS = [
  'ID',
  'Recibida',
  'Estado',
  'Nombre',
  'Teléfono',
  'Email',
  'Fecha',
  'Hora',
  'Comensales',
  'Petición',
];
