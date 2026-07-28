# Reservas — Cloudflare Worker + Google Sheet

Recoge las solicitudes del formulario de `contacto.html`, las valida, comprueba
aforo, las escribe en una pestaña del Google Sheet y avisa por email.

**Registra solicitudes, no confirma reservas.** La web dice "te confirmamos por
teléfono", así que todas las filas entran como `Pendiente` y se cierran por
llamada. Si algún día quieres confirmación automática, hay que cambiar antes el
copy de la página.

```
src/config.js        Horarios, aforo y límites — lo único que se toca a menudo
src/validate.js      Validación y normalización (con tests)
src/google-auth.js   JWT RS256 → access token de Google
src/sheets.js        Lectura de aforo y escritura de filas
src/email.js         Avisos vía Resend
src/index.js         Worker: CORS, rate limit, honeypot, orquestación
```

## Puesta en marcha

### 1. Google Sheet

Crea un Sheet con una pestaña llamada **`Reservas`**. No hace falta poner
cabeceras: el Worker las escribe solo la primera vez.

Apunta el ID, que está en la URL:
`docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`

### 2. Service account de Google

1. En [console.cloud.google.com](https://console.cloud.google.com) crea un proyecto.
2. **APIs y servicios → Biblioteca → Google Sheets API → Habilitar**.
3. **Credenciales → Crear credenciales → Cuenta de servicio**.
4. Dentro de la cuenta creada: **Claves → Añadir clave → Crear → JSON**. Se descarga un `.json`.
5. Abre el Sheet y **compártelo como Editor** con el `client_email` de ese JSON
   (algo como `tj-reservas@...iam.gserviceaccount.com`). Sin este paso el Worker
   recibe un 403.

### 3. Email (Resend)

MailChannels, la vía gratuita clásica desde Workers, retiró su tier gratis en
2024. Aquí se usa [Resend](https://resend.com): plan gratuito de 3.000 correos/mes.

Crea la cuenta, verifica el dominio y genera una API key. `FROM_EMAIL` tiene que
estar en el dominio verificado (p. ej. `reservas@latabernadelherrero.es`);
`NOTIFY_EMAIL` es donde quiere recibir los avisos el restaurante.

### 4. Secretos y despliegue

```bash
cd reservas
npm install

npx wrangler secret put SHEET_ID
npx wrangler secret put GOOGLE_CLIENT_EMAIL      # client_email del JSON
npx wrangler secret put GOOGLE_PRIVATE_KEY       # private_key del JSON, entera
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put FROM_EMAIL
npx wrangler secret put NOTIFY_EMAIL

npx wrangler deploy
```

La `GOOGLE_PRIVATE_KEY` se pega **completa**, incluidas las líneas
`-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----`. El código acepta
tanto saltos de línea reales como `\n` escapados.

> El `.json` del service account **no debe acabar en el repositorio**. Los
> secretos viven en Cloudflare; el archivo descargado guárdalo aparte.

### 5. Conectar el formulario

`wrangler deploy` imprime la URL del Worker. Pégala en `contacto.html`:

```html
<form class="form" novalidate data-endpoint="https://tj-reservas.TU-CUENTA.workers.dev">
```

Y añade tu dominio a `ALLOWED_ORIGINS` en `wrangler.toml`. Sin eso el navegador
bloquea la petición por CORS.

Mientras `data-endpoint` esté vacío, el formulario no finge que envía: muestra un
aviso pidiendo que llamen por teléfono.

## Reglas de negocio

En `src/config.js`:

| Ajuste | Valor | Qué hace |
| --- | --- | --- |
| `OPENING_HOURS` | mié–dom | Lunes y martes cerrado |
| `MAX_COVERS_PER_WINDOW` | **40** | **Estimado — ajústalo al aforo real** |
| `WINDOW_MINUTES` | 90 | Margen que cuenta como misma franja |
| `MAX_PARTY_SIZE` | 12 | Por encima, se deriva al teléfono |
| `MIN_MINUTES_NOTICE` | 60 | Margen mínimo para reservas de hoy |

El aforo de 40 es una suposición mía: no sé cuántos cubiertos entran. **Cámbialo
antes de publicar**, porque de ese número depende cuándo el sistema empieza a
rechazar peticiones.

Los cierres de madrugada están contemplados: jueves, viernes y sábado cierran a
la 1:00, así que una petición para "viernes 00:30" se valida contra el servicio
del jueves, no contra el del viernes. Hay tests que lo cubren.

## Tests

```bash
npm test
```

Cubren horarios, cierres de madrugada, normalización de teléfonos, límites de
grupo y la inyección de fórmulas en Sheets. No cubren las llamadas a Google ni a
Resend — para eso está `npx wrangler dev` con secretos de prueba.

## Seguridad

- **Inyección de fórmulas**: se escribe con `valueInputOption=RAW` y además se
  antepone un apóstrofo a lo que empiece por `=`, `+`, `-` o `@`.
- **CORS** restringido a `ALLOWED_ORIGINS`.
- **Rate limit** de 5 peticiones por IP cada 10 minutos. Es en memoria del
  isolate, así que no es estricto: frena el abuso trivial, no un ataque dirigido.
  Si hiciera falta algo firme, la vía son Durable Objects o KV.
- **Honeypot** oculto; a los bots se les responde 200 para no darles pistas.

## Límite conocido

Entre que se comprueba el aforo y se escribe la fila no hay bloqueo: dos
peticiones simultáneas para la misma franja podrían pasar juntas y superar el
máximo. Con el volumen de un restaurante es poco probable, y como todo se
confirma por teléfono se detecta antes de sentar a nadie. Resolverlo de verdad
pide un Durable Object que serialice las escrituras por fecha.
