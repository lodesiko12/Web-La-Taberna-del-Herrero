/**
 * Token de acceso a la API de Google desde un Worker.
 *
 * La librería `googleapis` no funciona aquí (depende de APIs de Node), así que
 * se firma el JWT a mano con Web Crypto y se canjea por un access token.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Cache por isolate. Evita una firma RSA y un round-trip en cada petición. */
let cached = { token: null, expiresAt: 0 };

function base64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlJson(obj) {
  return base64url(new TextEncoder().encode(JSON.stringify(obj)));
}

/**
 * Importa la clave privada PKCS#8 del service account.
 * Wrangler entrega los saltos de línea escapados, de ahí el replace.
 */
async function importPrivateKey(pem) {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);

  // 60 s de margen para no usar un token que caduque en vuelo.
  if (cached.token && cached.expiresAt > now + 60) return cached.token;

  if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Faltan GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY');
  }

  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64urlJson({ alg: 'RS256', typ: 'JWT' })}.${base64urlJson(claim)}`;
  const key = await importPrivateKey(env.GOOGLE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google rechazó el JWT (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  cached = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) };
  return cached.token;
}
