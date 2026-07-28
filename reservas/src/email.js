/**
 * Avisos por email vía Resend.
 *
 * Nota: MailChannels, que era la vía gratuita clásica desde Workers, retiró su
 * tier gratis en junio de 2024. Resend tiene plan gratuito (3.000 correos/mes)
 * y solo necesita verificar el dominio.
 *
 * Los fallos de envío se registran pero no rompen la petición: la reserva ya
 * está en el Sheet, y perderla por un problema de correo sería peor.
 */

const RESEND_URL = 'https://api.resend.com/emails';

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

async function send(env, { to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    console.log('Email no configurado, se omite el envío a', to);
    return;
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    console.error('Resend falló:', res.status, await res.text());
  }
}

/** Aviso al restaurante. Este es el que importa: sin él nadie se entera. */
export async function notifyRestaurant(env, r) {
  if (!env.NOTIFY_EMAIL) return;

  const rows = [
    ['Nombre', r.nombre],
    ['Teléfono', r.telefono],
    ['Email', r.email || '—'],
    ['Fecha', r.fecha],
    ['Hora', r.hora],
    ['Comensales', r.comensales],
    ['Petición', r.peticion || '—'],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#666">${k}</td><td style="padding:6px 0"><strong>${escapeHtml(v)}</strong></td></tr>`
    )
    .join('');

  await send(env, {
    to: env.NOTIFY_EMAIL,
    replyTo: r.email || undefined,
    subject: `Reserva ${r.fecha} ${r.hora} · ${r.nombre} (${r.comensales} pax)`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <h2 style="margin:0 0 4px">Nueva solicitud de reserva</h2>
        <p style="margin:0 0 16px;color:#666">Pendiente de confirmar por teléfono.</p>
        <table style="border-collapse:collapse;font-size:15px">${rows}</table>
        <p style="margin:20px 0 0;font-size:13px;color:#888">Ref. ${escapeHtml(r.id)}</p>
      </div>`,
  });
}

/** Acuse al cliente. Solo si dejó email, y deja claro que aún no está confirmada. */
export async function acknowledgeCustomer(env, r) {
  if (!r.email) return;

  await send(env, {
    to: r.email,
    replyTo: env.NOTIFY_EMAIL || undefined,
    subject: 'Hemos recibido tu solicitud de reserva',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <h2 style="margin:0 0 12px">Gracias, ${escapeHtml(r.nombre)}</h2>
        <p style="margin:0 0 16px">
          Hemos recibido tu solicitud para el <strong>${escapeHtml(r.fecha)}</strong>
          a las <strong>${escapeHtml(r.hora)}</strong> para
          <strong>${escapeHtml(r.comensales)}</strong> personas.
        </p>
        <p style="margin:0 0 16px">
          <strong>Todavía no es una reserva confirmada.</strong> Te llamamos en breve
          al ${escapeHtml(r.telefono)} para cerrarla.
        </p>
        <p style="margin:0;color:#666;font-size:14px">
          TJ · La Taberna del Herrero<br>
          Av. Literato Azorín, 8 · 30510 Yecla, Murcia<br>
          611 51 05 50
        </p>
      </div>`,
  });
}
