# TJ · La Taberna del Herrero — Contexto del proyecto

> Handoff entre sesiones. Última actualización: 2026-10-01.
> Lee este archivo entero antes de tocar nada. La sección **## Pendientes** es por dónde seguir.

---

## Qué es

Web de restaurante (Yecla, Murcia) implementada desde un proyecto de Claude Design.
Sitio **estático** (HTML/CSS/JS, sin build, sin dependencias) con reservas por **widget embebido**.

- Proyecto de diseño origen: `claude.ai/design/p/5115e5a6-03bf-48bb-9d72-039f0c5832fb`
- Repo git: inicializado, rama `main`. Remoto: github.com/lodesiko12/Web-La-Taberna-del-Herrero (público).

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
- **Optimizado (2026-10-01)**: fotos en WebP (`.webp`, ~200 KB en total) y vídeo hero a 1280×720 H.264 sin audio (1,9 MB, antes 18 MB). Sitio ≈ 2,2 MB. ffmpeg está instalado vía winget (`ffmpeg`); los originales PNG/MP4 están en el historial de git.
- **3 tarjetas siguen siendo placeholders vacíos** (eran huecos vacíos en el propio diseño), marcadas con comentarios HTML: croquetas de boletus (home), terraza y chimenea (nosotros). Renderizan como paneles oscuros con su título.


### Reservas — widget de terceros (Turnigo)
- Las reservas se hacen con un **widget embebido** en `contacto.html` (`#reservas-widget`,
  `data-slug="tj-la-taberna-del-herrero"`, script `https://turnigo-widget.lodesiko12.workers.dev/embed.js`).
  Servicio de Javier (el dominio del worker es su cuenta `lodesiko12`; suposición mía); toda la lógica (aforo, franjas, emails) vive allí, no en este repo.
- Se **descartó el sistema propio** (Cloudflare Pages Functions + Durable Object + Google Sheet + Resend) y se borró `reservas/`
  (commit del 2026-10-01; recuperable en el historial de git, commits `19a3b45`/`15b81ce`).
- La función principal de la web es que el cliente reserve mesa: los botones "Reservar" de la cabecera apuntan a `contacto.html`.
- **No hay secretos en este repo**: el sitio es 100 % estático.

---

## Errores ya resueltos (no repetir)

- **Sync de diseño trunca a 256 KiB**: vídeo, fotos, fuentes y logo llegaron cortados. Se sacaron los originales del disco (Downloads / Pictures) y se verificaron byte-idénticos antes de copiar.
- **PowerShell `GetPixel`/`SetPixel` es lentísimo** sobre cientos de miles de píxeles → `make-cream-logo.ps1` usa C# con `LockBits`.
- **`$PSScriptRoot` queda vacío** al invocar con ruta relativa `-File` → derivar el dir del script de `$MyInvocation.MyCommand.Path`. (Un primer intento escribió en `C:\assets` por esto.)
- **Tool `navigate`** del browser pane necesita `tabId` explícito.
- El panel de preview renderiza archivos fuera del proyecto como snapshots estáticos y a veces cachea/cuelga — verificar con `read_page` o a nivel de archivo, no solo por screenshot.

---

## Estado del repo

- Rama `main`, subida a GitHub (`origin`, público).
- `.gitignore` (raíz) bloquea `.dev.vars`, `*.json` de credenciales y `node_modules/`; permite `menu.json`, `package.json`. Verificado con `git check-ignore`.
- `.gitattributes` normaliza saltos de línea (LF en repo).
- Identidad git local: `Javier` / `lodesiko12@gmail.com`.

---

## Pendientes

1. **Revisar el widget de reservas en navegador**: cómo se ve sobre el fondo oscuro, en móvil, y confirmar que el copy "reserva confirmada al momento" (en `contacto.html`) es cierto según cómo configure Turnigo las reservas.

2. **Opcional**: rellenar las 3 tarjetas placeholder (croquetas boletus en home; terraza y chimenea en nosotros) si Javier consigue las fotos.
3. **Opcional**: poner el widget también en la home (ojo: el `id="reservas-widget"` no puede duplicarse en una página).

---

## Estructura de archivos

```
index.html  carta.html  nosotros.html  contacto.html   ← páginas (carta es generada)
README.md  CLAUDE.md  .gitignore  .gitattributes
assets/css/site.css        tokens + estilos
assets/js/site.js          nav móvil
assets/data/menu.json      la carta, como datos
assets/img/                6 imágenes (logo + 4 fotos + fondo CTA)
assets/video/hero-video.mp4
tools/build-carta.js       genera carta.html desde menu.json
tools/make-cream-logo.ps1  genera el logo cream desde el master negro
```
