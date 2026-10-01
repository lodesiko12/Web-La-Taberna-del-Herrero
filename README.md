# TJ · La Taberna del Herrero

Static site implemented from the [Claude Design project](https://claude.ai/design/p/5115e5a6-03bf-48bb-9d72-039f0c5832fb).
Plain HTML/CSS/JS — no build step, no dependencies. Drag the folder onto any static
host (Hostinger, Netlify, GitHub Pages) and it runs.

```
index.html          Inicio
carta.html          La Carta  (generated — see below)
nosotros.html       Nosotros
contacto.html       Reservas y contacto
assets/css/site.css Design tokens + all component styles
assets/js/site.js   Mobile nav, form acknowledgement
assets/data/menu.json  The menu, as data
tools/build-carta.js   Renders carta.html from menu.json
```

## Media

All photography, the hero video and the logo are in place.

The design sync API caps transfers at 256 KiB, so the large assets came back
truncated and were sourced from the originals on disk instead. Each was verified
byte-identical to the design asset before being copied in.

### Regenerating the logo

`assets/img/tj-mark-cream.png` is derived from the black-on-white master logo — the
header and footer are dark, so the mark has to be cream on transparency. To rebuild
it from a new master:

```
powershell -File tools/make-cream-logo.ps1 -Source "C:\ruta\logo.jpg"
```

Ink becomes cream (`#EEE9E0`, the `--text` token), white becomes transparent, and
mid greys keep partial alpha so the flame's antialiased edges stay smooth. The
counters — the `TJ` letters and the fork tines — stay knocked out, so the page
background shows through them exactly as in the original mark.

### Two things worth doing

- **The hero video is 17.8 MB**, which is a heavy download on mobile. Re-encoding to
  720p H.264 at a lower bitrate typically lands under 3 MB with no visible loss at
  the size it renders. A `poster` frame is already set so the hero shows something
  immediately while it loads.
- **Photos are unoptimised PNGs** (`tomas-jose.png` alone is 1.7 MB). Converting the
  four to WebP would cut roughly 3 MB of page weight.

Three photos were never filled in the design either — they were empty placeholder
slots. Those cards currently render as dark panels with their captions intact;
each is marked with an HTML comment:

- homepage — croquetas de boletus con trufa
- nosotros — terraza
- nosotros — chimenea

## Editing the menu

`carta.html` is generated. Edit `assets/data/menu.json`, then:

```bash
node tools/build-carta.js
```

Each dish takes `name`, `price`, and optionally `description`, `recommended`, and
`glutenFree` (renders the `(SG)` mark). A `price` without digits — `"Consultar"` —
automatically switches to the plain text style.

## Notes on the conversion

- **Fonts** are loaded from Google Fonts (Syne, Cormorant Garamond, Inter) rather
  than self-hosted `.ttf` files, which also hit the transfer cap. Same families,
  same weights.
- **Responsive behaviour** was JS-driven in the design (a `isMobile` state re-rendering
  the nav). It's now a CSS media query at the same 860px breakpoint, so the layout
  is correct before JS runs.
- **Reservations** use an embedded third-party widget (Turnigo) in `contacto.html`,
  mounted via `#reservas-widget` with `data-slug="tj-la-taberna-del-herrero"`.
- A fixed `width: 843px; height: 328px` on the homepage philosophy section was
  dropped; it was a design-canvas frame artifact, not a layout intent.
