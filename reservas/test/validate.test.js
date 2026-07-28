import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOpenAt, validateReservation, sanitiseCell, toMinutes } from '../src/validate.js';

// 2026-07-20 es lunes, así que la semana de referencia va del 20 al 26.
const LUNES = '2026-07-20';
const MARTES = '2026-07-21';
const MIERCOLES = '2026-07-22';
const JUEVES = '2026-07-23';
const VIERNES = '2026-07-24';
const SABADO = '2026-07-25';
const DOMINGO = '2026-07-26';

test('días de cierre', () => {
  assert.equal(isOpenAt(LUNES, '21:00'), false);
  assert.equal(isOpenAt(MARTES, '21:00'), false);
});

test('horario normal de tarde', () => {
  assert.equal(isOpenAt(MIERCOLES, '14:00'), true);
  assert.equal(isOpenAt(MIERCOLES, '13:29'), false, 'antes de abrir');
  assert.equal(isOpenAt(MIERCOLES, '13:30'), true, 'justo al abrir');
});

test('miércoles cierra a las 23:30, no de madrugada', () => {
  assert.equal(isOpenAt(MIERCOLES, '23:00'), true);
  assert.equal(isOpenAt(MIERCOLES, '23:45'), false);
  // El jueves de madrugada no hereda nada del miércoles.
  assert.equal(isOpenAt(JUEVES, '00:30'), false);
});

test('el cierre de madrugada pertenece al servicio del día anterior', () => {
  // Viernes 00:30 es en realidad la noche del jueves, que cierra a la 1:00.
  assert.equal(isOpenAt(VIERNES, '00:30'), true);
  assert.equal(isOpenAt(SABADO, '00:30'), true);
  assert.equal(isOpenAt(DOMINGO, '00:30'), true, 'madrugada heredada del sábado');
  assert.equal(isOpenAt(VIERNES, '01:30'), false, 'ya han cerrado');
});

test('el domingo cierra a medianoche y no arrastra al lunes', () => {
  assert.equal(isOpenAt(DOMINGO, '23:30'), true);
  assert.equal(isOpenAt(LUNES, '00:30'), false);
});

test('rechaza fechas pasadas', () => {
  const now = new Date('2026-07-22T10:00:00Z');
  const r = validateReservation(
    { nombre: 'Ana', telefono: '611510550', fecha: '2026-07-21', hora: '21:00', comensales: 2 },
    now
  );
  assert.equal(r.ok, false);
  assert.match(r.errors.fecha, /ha pasado/);
});

test('exige margen para reservas del mismo día', () => {
  // 20:30 en Madrid (verano, UTC+2) pidiendo mesa para las 21:00: 30 min.
  const now = new Date('2026-07-22T18:30:00Z');
  const r = validateReservation(
    { nombre: 'Ana', telefono: '611510550', fecha: MIERCOLES, hora: '21:00', comensales: 2 },
    now
  );
  assert.equal(r.ok, false);
  assert.match(r.errors.hora, /margen/);
});

test('acepta una reserva válida y normaliza el teléfono', () => {
  const now = new Date('2026-07-20T10:00:00Z');
  const r = validateReservation(
    {
      nombre: '  Ana Pérez ',
      telefono: '+34 611 51 05 50',
      fecha: VIERNES,
      hora: '21:30',
      comensales: 4,
      peticion: 'Terraza si puede ser',
    },
    now
  );
  assert.equal(r.ok, true);
  assert.equal(r.data.telefono, '611510550');
  assert.equal(r.data.nombre, 'Ana Pérez');
});

test('rechaza teléfonos que no son españoles', () => {
  const now = new Date('2026-07-20T10:00:00Z');
  const base = { nombre: 'Ana', fecha: VIERNES, hora: '21:30', comensales: 2 };

  for (const telefono of ['123', '511510550', '+44 20 7946 0000', '']) {
    const r = validateReservation({ ...base, telefono }, now);
    assert.equal(r.ok, false, `debería rechazar ${telefono}`);
    assert.ok(r.errors.telefono);
  }
});

test('el email es opcional pero se valida si viene', () => {
  const now = new Date('2026-07-20T10:00:00Z');
  const base = { nombre: 'Ana', telefono: '611510550', fecha: VIERNES, hora: '21:30', comensales: 2 };

  assert.equal(validateReservation(base, now).ok, true, 'sin email debe pasar');
  assert.equal(validateReservation({ ...base, email: 'no-es-email' }, now).ok, false);
  assert.equal(validateReservation({ ...base, email: 'ana@example.com' }, now).ok, true);
});

test('deriva los grupos grandes al teléfono', () => {
  const now = new Date('2026-07-20T10:00:00Z');
  const r = validateReservation(
    { nombre: 'Ana', telefono: '611510550', fecha: VIERNES, hora: '21:30', comensales: 20 },
    now
  );
  assert.equal(r.ok, false);
  assert.match(r.errors.comensales, /llámanos/);
});

test('neutraliza la inyección de fórmulas en Sheets', () => {
  assert.equal(sanitiseCell('=IMPORTXML(A1,"//x")'), "'=IMPORTXML(A1,\"//x\")");
  assert.equal(sanitiseCell('+1'), "'+1");
  assert.equal(sanitiseCell('@mención'), "'@mención");
  assert.equal(sanitiseCell('Ana Pérez'), 'Ana Pérez');
});

test('toMinutes', () => {
  assert.equal(toMinutes('00:00'), 0);
  assert.equal(toMinutes('13:30'), 810);
  assert.equal(toMinutes('24:00'), 1440);
});
