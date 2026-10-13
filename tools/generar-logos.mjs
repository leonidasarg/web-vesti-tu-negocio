/**
 * Genera los lockups de Vestí Tu Negocio con el texto convertido a curvas.
 * Archivo es OFL-1.1: usar sus contornos dentro de un logo está permitido.
 *
 * Requiere:  npm i opentype.js  + el TTF estático de Archivo 800 / wdth 112.
 *
 * Todo se mide por CAJA DE TINTA, no por avance tipográfico: la tilde de la Í
 * sobresale del avance y si no se contempla queda cortada contra el borde.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import opentype from "opentype.js";

const DESTINO = "brand";
const TTF = "tools/archivo-800-112.ttf";

// Google Fonts entrega una instancia estática del eje pedido si el user-agent
// no soporta woff2. wdth 112 corresponde a font-stretch: semi-expanded.
if (!existsSync(TTF)) {
  const css = await (await fetch(
    "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112,800",
    { headers: { "User-Agent": "Mozilla/4.0" } },
  )).text();
  const bloque = css.split("@font-face").find((b) => b.includes("semi-expanded"));
  const url = bloque.match(/https:\/\/[^)]+\.ttf/)[0];
  writeFileSync(TTF, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`Archivo descargado: ${TTF}\n`);
}

const font = opentype.parse(readFileSync(TTF).buffer);
const upm = font.unitsPerEm;

const MAGENTA = "#D6006E";
const TINTA = "#15131A";
const BLANCO = "#FFFFFF";
const r = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------- composición de texto
// Glifo por glifo: el shaper de opentype.js se cae con la Í.
function componer(texto, size, ls) {
  const camino = new opentype.Path();
  let x = 0, previo = null;
  for (const ch of texto) {
    const g = font.charToGlyph(ch);
    if (previo) x += (font.getKerningValue(previo, g) / upm) * size;
    camino.extend(g.getPath(x, 0, size));
    x += (g.advanceWidth / upm) * size + ls * size;
    previo = g;
  }
  const bb = camino.getBoundingBox();
  return { camino, bb, ancho: bb.x2 - bb.x1, izq: bb.x1, tope: bb.y1, pie: bb.y2 };
}

/** El ancho de tinta crece linealmente con el tracking: se resuelve exacto. */
function lsParaAnchoTinta(texto, size, objetivo) {
  const a = componer(texto, size, 0);
  const b = componer(texto, size, 0.1);
  return (0.1 * (objetivo - a.ancho)) / (b.ancho - a.ancho);
}

// ------------------------------------------------------------- tipografía
const S1 = 100;
const S2 = 41;
const linea1 = componer("VESTÍ", S1, 0.012);
const LS2 = lsParaAnchoTinta("TU NEGOCIO", S2, linea1.ancho);
const linea2 = componer("TU NEGOCIO", S2, LS2);

const CAP1 = 0.687 * S1;          // altura de mayúscula, sin contar la tilde
const CAP2 = 0.699 * S2;
const AIRE_LINEAS = 14;
const BASE2 = AIRE_LINEAS + CAP2; // baseline de la línea 2 respecto de la 1
const ALTO_CAPS = CAP1 + AIRE_LINEAS + CAP2;

const d1 = linea1.camino.toPathData(2);
const d2 = linea2.camino.toPathData(2);

// ---------------------------------------------------------------- isotipo
const ISO = 118;
const K = ISO / 32;
const X = 7 * K;                  // unidad X del manual = radio de la esquina
const AIRE_ISO = 0.6 * X;

const isoColor = (tx, ty) => `  <g transform="translate(${r(tx)} ${r(ty)}) scale(${r(K)})">
    <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="${MAGENTA}"/>
    <circle cx="8" cy="8" r="1.9" fill="${BLANCO}"/>
    <path d="M8.6 10.8h4.9l2.5 5.4 2.5-5.4h4.9L16 24.6Z" fill="${BLANCO}"/>
  </g>`;

const isoCalado = (color) => (tx, ty) => `  <g transform="translate(${r(tx)} ${r(ty)}) scale(${r(K)})">
    <path fill="${color}" fill-rule="evenodd" d="M8.5 1.5h15a7 7 0 0 1 7 7v15a7 7 0 0 1-7 7h-15a7 7 0 0 1-7-7v-15a7 7 0 0 1 7-7Z M8 6.1a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 1 0 0-3.8Z M8.6 10.8h4.9l2.5 5.4 2.5-5.4h4.9L16 24.6Z"/>
  </g>`;

// ------------------------------------------------------------------ armado
function escribir(archivo, titulo, caja, piezas) {
  const w = caja.x2 - caja.x1, h = caja.y2 - caja.y1;
  const cuerpo = piezas.map((p) => p(-caja.x1, -caja.y1)).join("\n");
  writeFileSync(`${DESTINO}/${archivo}`,
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" width="${Math.round(w * 2)}" height="${Math.round(h * 2)}" role="img" aria-label="Vestí Tu Negocio">
  <title>${titulo}</title>
${cuerpo}
</svg>
`);
  console.log(`${archivo.padEnd(36)} ${r(w)} x ${r(h)}`);
}

const union = (...cajas) => ({
  x1: Math.min(...cajas.map((c) => c.x1)), y1: Math.min(...cajas.map((c) => c.y1)),
  x2: Math.max(...cajas.map((c) => c.x2)), y2: Math.max(...cajas.map((c) => c.y2)),
});

/** isotipo a la izquierda, dos líneas de texto a la derecha */
function horizontal(archivo, titulo, iso, c1, c2) {
  const yTopeCaps = ISO / 2 - ALTO_CAPS / 2;   // bloque de texto centrado contra el isotipo
  const base1 = yTopeCaps + CAP1;
  const xTxt = ISO + AIRE_ISO - linea1.izq;    // la tinta arranca justo después del aire

  const cajaIso = { x1: 0, y1: 0, x2: ISO, y2: ISO };
  const caja1 = { x1: xTxt + linea1.bb.x1, y1: base1 + linea1.tope, x2: xTxt + linea1.bb.x2, y2: base1 + linea1.pie };
  const caja2 = { x1: xTxt + linea2.bb.x1, y1: base1 + BASE2 + linea2.tope, x2: xTxt + linea2.bb.x2, y2: base1 + BASE2 + linea2.pie };

  escribir(archivo, titulo, union(cajaIso, caja1, caja2), [
    (dx, dy) => iso(dx, dy),
    (dx, dy) => `  <path fill="${c1}" d="${d1}" transform="translate(${r(xTxt + dx)} ${r(base1 + dy)})"/>`,
    (dx, dy) => `  <path fill="${c2}" d="${d2}" transform="translate(${r(xTxt + dx)} ${r(base1 + BASE2 + dy)})"/>`,
  ]);
}

/** isotipo arriba, texto centrado debajo */
function vertical(archivo, titulo, iso, c1, c2) {
  const AIRE_V = 0.75 * X;
  const ancho = Math.max(ISO, linea1.ancho);
  const xIso = (ancho - ISO) / 2;
  const xTxt = (ancho - linea1.ancho) / 2 - linea1.izq;
  const base1 = ISO + AIRE_V + CAP1;

  const cajaIso = { x1: xIso, y1: 0, x2: xIso + ISO, y2: ISO };
  const caja1 = { x1: xTxt + linea1.bb.x1, y1: base1 + linea1.tope, x2: xTxt + linea1.bb.x2, y2: base1 + linea1.pie };
  const xTxt2 = (ancho - linea2.ancho) / 2 - linea2.izq;
  const caja2 = { x1: xTxt2 + linea2.bb.x1, y1: base1 + BASE2 + linea2.tope, x2: xTxt2 + linea2.bb.x2, y2: base1 + BASE2 + linea2.pie };

  escribir(archivo, titulo, union(cajaIso, caja1, caja2), [
    (dx, dy) => iso(xIso + dx, dy),
    (dx, dy) => `  <path fill="${c1}" d="${d1}" transform="translate(${r(xTxt + dx)} ${r(base1 + dy)})"/>`,
    (dx, dy) => `  <path fill="${c2}" d="${d2}" transform="translate(${r(xTxt2 + dx)} ${r(base1 + BASE2 + dy)})"/>`,
  ]);
}

/** solo el texto, una línea */
function wordmark(archivo, titulo, c1, c2) {
  const S = 70;
  const a = componer("VESTÍ", S, 0.012);
  const b = componer("TU NEGOCIO", S, 0.012);
  const espacio = (font.charToGlyph(" ").advanceWidth / upm) * S;
  const x2 = a.ancho - a.izq + espacio;

  const caja = union(
    { x1: -a.izq + a.bb.x1, y1: a.tope, x2: -a.izq + a.bb.x2, y2: a.pie },
    { x1: x2 + b.bb.x1, y1: b.tope, x2: x2 + b.bb.x2, y2: b.pie },
  );
  escribir(archivo, titulo, caja, [
    (dx, dy) => `  <path fill="${c1}" d="${a.camino.toPathData(2)}" transform="translate(${r(-a.izq + dx)} ${r(dy)})"/>`,
    (dx, dy) => `  <path fill="${c2}" d="${b.camino.toPathData(2)}" transform="translate(${r(x2 + dx)} ${r(dy)})"/>`,
  ]);
}

console.log(`VESTÍ ancho de tinta ${r(linea1.ancho)} · TU NEGOCIO tracking ${r(LS2 * 1000)}/1000 em · líneas al mismo ancho\n`);

horizontal("logo-horizontal.svg", "Vestí Tu Negocio — lockup horizontal", isoColor, TINTA, MAGENTA);
horizontal("logo-horizontal-blanco.svg", "Vestí Tu Negocio — horizontal a un color, blanco", isoCalado(BLANCO), BLANCO, BLANCO);
horizontal("logo-horizontal-tinta.svg", "Vestí Tu Negocio — horizontal a un color, tinta", isoCalado(TINTA), TINTA, TINTA);
vertical("logo-vertical.svg", "Vestí Tu Negocio — lockup vertical", isoColor, TINTA, MAGENTA);
vertical("logo-vertical-blanco.svg", "Vestí Tu Negocio — vertical a un color, blanco", isoCalado(BLANCO), BLANCO, BLANCO);
wordmark("logo-wordmark.svg", "Vestí Tu Negocio — solo texto", TINTA, MAGENTA);
