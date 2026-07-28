import { validateReservation, nowInTimezone } from './validate.js';
import { countCoversInWindow, hasCapacity, appendReservation, ensureHeaders } from './sheets.js';
import { notifyRestaurant, acknowledgeCustomer } from './email.js';
import { RATE_LIMIT, MAX_COVERS_PER_WINDOW } from './config.js';

/**
 * Contador por IP en memoria del isolate. No es un rate limit distribuido —
 * Cloudflare puede tener varios isolates activos — pero corta el abuso trivial
 * sin coste. Si hace falta algo serio, la vía es Durable Objects o KV.
 */
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const windowMs = RATE_LIMIT.windowMinutes * 60_000;
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= RATE_LIMIT.maxRequests) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);

  // Poda perezosa para que el Map no crezca sin límite.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < windowMs)) hits.delete(key);
    }
  }

  return false;
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const origin = request.headers.get('Origin') ?? '';
  const ok = allowed.includes(origin);

  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Método no permitido' }, 405, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'desconocida';
    if (rateLimited(ip)) {
      return json(
        { error: 'Demasiadas solicitudes seguidas. Espera unos minutos o llámanos al 611 51 05 50.' },
        429,
        cors
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Petición mal formada.' }, 400, cors);
    }

    // Honeypot: campo oculto que sólo rellenan los bots. Se responde 200 para
    // no darles señal de que han sido detectados.
    if (body?.web) {
      return json({ ok: true }, 200, cors);
    }

    const result = validateReservation(body);
    if (!result.ok) {
      return json({ error: 'Revisa los datos.', fields: result.errors }, 422, cors);
    }

    const data = result.data;

    try {
      await ensureHeaders(env);

      const existing = await countCoversInWindow(env, data.fecha, data.hora);
      if (!hasCapacity(existing, data.comensales)) {
        return json(
          {
            error:
              'Justo esa franja la tenemos completa. Prueba con otra hora o llámanos al 611 51 05 50 y lo miramos.',
            fields: { hora: 'Sin disponibilidad a esa hora.' },
          },
          409,
          cors
        );
      }

      const now = nowInTimezone();
      const reservation = {
        ...data,
        id: `R-${Date.now().toString(36).toUpperCase()}`,
        recibida: `${now.date} ${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`,
      };

      await appendReservation(env, reservation);

      // El correo va después de responder: la reserva ya está guardada y el
      // cliente no tiene por qué esperar al proveedor de email.
      ctx.waitUntil(
        Promise.all([
          notifyRestaurant(env, reservation),
          acknowledgeCustomer(env, reservation),
        ]).catch((err) => console.error('Fallo enviando avisos:', err))
      );

      return json({ ok: true, id: reservation.id }, 200, cors);
    } catch (err) {
      console.error('Error procesando la reserva:', err);
      return json(
        { error: 'No hemos podido registrar la reserva. Llámanos al 611 51 05 50 y te atendemos.' },
        500,
        cors
      );
    }
  },
};

export { MAX_COVERS_PER_WINDOW };
