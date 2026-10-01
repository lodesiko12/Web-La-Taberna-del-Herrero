# TJ · La Taberna del Herrero — Contexto del proyecto

> Handoff entre sesiones. Última actualización: 2026-10-01.
> Lee este archivo entero antes de tocar nada. La sección **## Pendientes** es por dónde seguir.

---

## Qué es

Web de restaurante (Yecla, Murcia) implementada desde un proyecto de Claude Design.
Sitio **estático** (HTML/CSS/JS, sin build, sin dependencias) + un **sistema de
reservas** propio todavía por terminar.

- Proyecto de diseño origen: `claude.ai/design/p/5115e5a6-03bf-48bb-9d72-039f0c5832fb`
- Repo git: inicializado, rama `main`, 1 commit. **Aún no subido a GitHub.**

### Datos del negocio (fuente de verdad del copy)
- Dirección: Av. Literato Azorín, 8 · 30510 Yecla, Murcia
- Teléfono: 611 51 05 50 · WhatsApp: wa.me/34611510550
- Instagram: @tjlatabernadelherrero
- Dueño: Tomás José ("TJ")
- Horario: Mié 13:30–23:30 · Jue/Vie/Sáb 13:30–1:00 · Dom 13:30–24:00 · Lun y Mar cerrado

---

## Cómo trabaja Javier (preferencias)

- **Responde siempre en español.**
- Quiere que le **señale los problemas y trade-offs con honestidad**, sin maquillar. Valora que se le diga "esto es una suposición mía" o "esto puede fallar en X caso".
- Distingue claramente entre **lo que decide él** (reglas de negocio, producto) y **lo que puedo resolver yo** con un criterio por defecto. Explicítalo.
- A veces pide **solo análisis, NO implementación** ("no lo hagas, solo dime si se puede"). Respetar eso al pie de la letra.
- Prefiere soluciones **mantenibles y basadas en datos** (ej. menú en JSON con generador, no markup repetido).
- Es **diseñador**: hace el diseño en Claude Design y luego lo importa para implementar. Tiene varias webs de clientes (Cheesecakeando, Fogón de Mara, IrisQuinquer, Los Cuchillos, Revoltoso, Bassalo…).
- Cuidadoso con los **secretos**: nunca al repositorio.

---

## Arquitectura y decisiones tomadas

### Web estática
- Sin build. Tokens de diseño (paleta oklch) en `assets/css/site.css`.
- **Fuentes desde Google Fonts** (Syne, Cormorant Garamond, Inter), no self-hosted — los `.ttf` superaban el límite de 256 KiB del sync de diseño.
- **Responsive por CSS** (media query a 860px). El diseño original lo hacía con JS (`isMobile`); se cambió para que el layout sea correcto antes de que cargue el JS.

### Carta (menú)
- **`carta.html` es generado — NO editar a mano.**
- Datos en `assets/data/menu.json` (50 platos, 8 secciones).
- Para cambiar la carta: editar el JSON y ejecutar `node tools/build-carta.js`.
- Campos por plato: `name`, `price`, y opcionales `description`, `recommended`, `glutenFree` (marca `(SG)`). Un `price` sin dígitos (ej. "Consultar") usa estilo de texto plano automáticamente.

### Logo
- El master es **negro sobre blanco**; la cabecera es oscura, así que se usa una versión **cream sobre transparencia** (cream = `#EEE9E0`, el token `--text`).
- Generado con `tools/make-cream-logo.ps1 -Source "ruta\logo.jpg"` → `assets/img/tj-mark-cream.png` (811×811).
- Las letras `TJ` y las puntas del tenedor quedan caladas (transparentes): se ve el fondo a través, como en el original.

### Media
- Todas las fotos (4) + vídeo hero + logo están colocados y verificados byte-idénticos a los originales del diseño.
- **3 tarjetas siguen siendo placeholders vacíos** (eran huecos vacíos en el propio diseño), marcadas con comentarios HTML: croquetas de boletus (home), terraza y chimenea (nosotros). Renderizan como paneles oscuros con su título.

### Reservas — DECIDIDO (pero aún NO implementado así)
El código actual en `reservas/` es una **versión antigua** que NO refleja estas decisiones. Hay que reescribirlo:

1. **Sistema propio** (Opción 3): Cloudflare + Google Sheet. El cliente ya edita Sheets, le resulta familiar.
2. **Migrar de Worker a Cloudflare Pages Functions** (`functions/api/reservar.js`). Al estar en el mismo origen que la web, **desaparece el CORS entero** (se puede borrar `ALLOWED_ORIGINS` y el preflight).
3. **Confirmación 100% automática** (sin llamada telefónica). → Obliga a **reescribir el copy** de la web (ver Pendientes).
4. **Email a cliente Y a dueño** con Resend. Obligatorio. (MailChannels retiró su tier gratis en 2024). Verificar dominio propio es **requisito** — el dominio de pruebas de Resend solo envía a tu propia dirección. Añadir **SPF/DKIM/DMARC** o acaba en spam.
5. **Durable Object por fecha** (requiere plan **Workers Paid, 5 $/mes** — no hay tier gratis). Serializa las escrituras del mismo día → elimina la condición de carrera, y mantiene el recuento del día en memoria usando el Sheet como registro, no como base de datos.
6. **Modelo de aforo por franjas** (ESTE es el acordado, sustituye a la ventana de ±90 min del código viejo):
   - Franjas de **30 min** (21:00, 21:30, 22:00…).
   - Cada reserva dura **2 h = ocupa 4 franjas consecutivas**. Una reserva a las 21:00 ocupa 21:00/21:30/22:00/22:30 y libera a las 23:00.
   - Una reserva nueva se acepta **solo si cabe en las 4 franjas** que ocuparía, no solo en la de entrada.
   - Se cuenta **por personas** (comensales). Limitación conocida: personas ≠ mesas, un grupo de 8 puede no caber aunque haya 8 huecos sueltos. El tope de 12 pax con derivación a teléfono hace de red.
   - El selector de hora debe pasar de `<input type="time">` libre a un **desplegable de franjas de 30 min** generado según el día.

---

## Cuentas y secretos (para producción)

Los secretos **NO van al repositorio**. Van en el panel de Cloudflare
(Settings → Environment variables). GitHub guarda el código; Cloudflare, las claves.

Hay que dar de alta / configurar:
- **Google Cloud**: proyecto + Google Sheets API habilitada + cuenta de servicio (JSON). Compartir el Sheet como **Editor** con el `client_email` del JSON (sin esto → 403).
- **Google Sheet** con pestaña `Reservas`.
- **Resend**: cuenta + **dominio verificado** + API key.
- **Cloudflare Pages** + **Workers Paid** (para Durable Objects).
- **GitHub**: repo (para gestión y copias).

Variables/secretos: `SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_RESTAURANTE`, `AFORO_MAXIMO`.
Plantilla local en `reservas/.dev.vars.example` (copiar a `.dev.vars`, está en .gitignore).

El `.json` de la cuenta de servicio **guárdalo fuera de la carpeta del proyecto**.

---

## Errores ya resueltos (no repetir)

- **Sync de diseño trunca a 256 KiB**: vídeo, fotos, fuentes y logo llegaron cortados. Se sacaron los originales del disco (Downloads / Pictures) y se verificaron byte-idénticos antes de copiar.
- **PowerShell `GetPixel`/`SetPixel` es lentísimo** sobre cientos de miles de píxeles → `make-cream-logo.ps1` usa C# con `LockBits`.
- **`$PSScriptRoot` queda vacío** al invocar con ruta relativa `-File` → derivar el dir del script de `$MyInvocation.MyCommand.Path`. (Un primer intento escribió en `C:\assets` por esto.)
- **`node --test test/`** interpreta el dir como módulo → usar `node --test test/*.test.js`.
- **Tool `navigate`** del browser pane necesita `tabId` explícito.
- El panel de preview renderiza archivos fuera del proyecto como snapshots estáticos y a veces cachea/cuelga — verificar con `read_page` o a nivel de archivo, no solo por screenshot.

---

## Estado del repo

- Rama `main`, commit inicial `19a3b45`, 31 archivos.
- `.gitignore` (raíz) bloquea `.dev.vars`, `*.json` de credenciales y `node_modules/`; permite `menu.json`, `package.json`. Verificado con `git check-ignore`.
- `.gitattributes` normaliza saltos de línea (LF en repo).
- Identidad git local: `Javier` / `lodesiko12@gmail.com`.

### Tests
`cd reservas && npm test` — 13/13 en verde. Cubren horarios, cierres de madrugada
(ej. "viernes 00:30" = servicio del jueves), normalización de teléfonos, límite de
grupo, inyección de fórmulas en Sheets. **Ojo**: estos tests son del modelo VIEJO
(±90 min); habrá que reescribirlos para el modelo de franjas de 30 min.

---

## Pendientes

> Orden sugerido para la próxima sesión.

1. **Pedir a Javier dos datos de negocio** (bloquean el sistema de reservas):
   - **Aforo real** (máximo de comensales que caben a la vez). El `30` actual es de ejemplo.
   - **Última hora reservable** (¿la marca él, o la calculo como cierre − 2 h?).

2. **Reescribir el sistema de reservas** con lo DECIDIDO (ver arriba):
   - Migrar a Cloudflare Pages Functions (`functions/api/reservar.js`), quitar CORS.
   - Modelo de franjas de 30 min, 2 h = 4 franjas, aceptar solo si cabe en las 4.
   - Durable Object por fecha (serializar + recuento del día).
   - Selector de hora → desplegable de franjas de 30 min.
   - Email a cliente + dueño vía Resend; añadir columna `email_enviado` en el Sheet.
   - Reescribir los tests para el nuevo modelo.

3. **Reescribir el copy de la web** para confirmación automática (quitar "te confirmamos por teléfono" / "llámanos"):
   - Formulario en `contacto.html`.
   - CTA de la home (`index.html`).
   - CTA de `nosotros.html`.

4. **Subir a GitHub**: crear el repo remoto y `git push -u origin main`. Recordar: secretos a Cloudflare, no a GitHub.

5. **Optimización de peso** (sitio ~22 MB, casi todo vídeo):
   - Vídeo hero 18 MB → reencodear a 720p H.264 (<3 MB). **No hay ffmpeg instalado** en la máquina.
   - Fotos PNG sin optimizar (tomas-jose.png = 1,7 MB) → WebP (~3 MB de ahorro).

6. **Opcional**: rellenar las 3 tarjetas placeholder (croquetas boletus en home; terraza y chimenea en nosotros) si Javier consigue las fotos.

---

## Estructura de archivos

```
index.html  carta.html  nosotros.html  contacto.html   ← páginas (carta es generada)
README.md  CLAUDE.md  .gitignore  .gitattributes
assets/css/site.css        tokens + estilos
assets/js/site.js          nav móvil + envío del formulario de reservas
assets/data/menu.json      la carta, como datos
assets/img/                6 imágenes (logo + 4 fotos + fondo CTA)
assets/video/hero-video.mp4
tools/build-carta.js       genera carta.html desde menu.json
tools/make-cream-logo.ps1  genera el logo cream desde el master negro
reservas/                  sistema de reservas (VERSIÓN VIEJA, a reescribir)
  src/ test/ wrangler.toml package.json README.md .dev.vars.example
```
