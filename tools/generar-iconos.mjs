#!/usr/bin/env node
/**
 * Genera los iconos de Vestí Tu Negocio a partir de la geometría del isotipo.
 * Sin dependencias: codifica PNG con el zlib del core de Node y rasteriza
 * las formas con supersampling 4x para los bordes.
 *
 * Uso, parado en la raíz del repo:   node tools/generar-iconos.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------- geometría
// Todo en el espacio 32x32 del isotipo, igual que logo.svg.
const CAJA = 32;
const BADGE = { x: 1.5, y: 1.5, w: 29, h: 29, r: 7 }; // placa redondeada
const OJAL = { cx: 8, cy: 8, r: 1.9 };                // ojal de la etiqueta
const UVE = [                                          // escote en V
  [8.6, 10.8], [13.5, 10.8], [16, 16.2],
  [18.5, 10.8], [23.4, 10.8], [16, 24.6],
];

const MAGENTA = "#D6006E";
const TINTA = "#15131A";
const BLANCO = "#FFFFFF";

// ------------------------------------------------------------------- color
function hexARgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ------------------------------------------------- pruebas de pertenencia
function enRectRedondeado(px, py, { x, y, w, h, r }) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  // zonas de las cuatro esquinas
  const cx = px < x + r ? x + r : px > x + w - r ? x + w - r : px;
  const cy = py < y + r ? y + r : py > y + h - r ? y + h - r : py;
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function enCirculo(px, py, { cx, cy, r }) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function enPoligono(px, py, pts) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// --------------------------------------------------------------- rasterizar
const SS = 4; // subdivisiones por lado: 16 muestras por pixel

/**
 * modo "placa"    -> placa redondeada, marca en color, afuera transparente
 * modo "lleno"    -> cuadrado completo sin esquinas (iOS y redes lo recortan solos)
 * modo "calado"   -> placa de un solo color con la marca como agujero transparente
 */
function rasterizar(tam, { modo, fondo, marca }) {
  const [fr, fg, fb] = hexARgb(fondo);
  const [mr, mg, mb] = marca ? hexARgb(marca) : [0, 0, 0];
  const px = Buffer.alloc(tam * tam * 4);
  const escala = CAJA / tam;

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ux = (x + (sx + 0.5) / SS) * escala;
          const uy = (y + (sy + 0.5) / SS) * escala;

          const enPlaca = modo === "lleno" ? true : enRectRedondeado(ux, uy, BADGE);
          if (!enPlaca) continue;

          const enMarca = enCirculo(ux, uy, OJAL) || enPoligono(ux, uy, UVE);

          if (enMarca && modo === "calado") continue; // agujero
          const [cr, cg, cb] = enMarca ? [mr, mg, mb] : [fr, fg, fb];
          r += cr; g += cg; b += cb; a += 255;
        }
      }

      const n = SS * SS;
      const i = (y * tam + x) * 4;
      if (a === 0) continue;                  // transparente
      const cob = a / n / 255;                // cobertura 0..1
      px[i] = Math.round(r / (a / 255));      // color sin premultiplicar
      px[i + 1] = Math.round(g / (a / 255));
      px[i + 2] = Math.round(b / (a / 255));
      px[i + 3] = Math.round(cob * 255);
    }
  }
  return px;
}

// --------------------------------------------------------------- PNG a mano
const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function codificarPng(tam, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8;  // 8 bits por canal
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filtro adaptativo
  ihdr[12] = 0; // sin entrelazado

  // cada scanline lleva adelante su byte de filtro (0 = sin filtro)
  const crudo = Buffer.alloc(tam * (tam * 4 + 1));
  for (let y = 0; y < tam; y++) {
    crudo[y * (tam * 4 + 1)] = 0;
    px.copy(crudo, y * (tam * 4 + 1) + 1, y * tam * 4, (y + 1) * tam * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(crudo, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------------- ICO a mano
function codificarIco(entradas) {
  const cab = Buffer.alloc(6);
  cab.writeUInt16LE(0, 0);              // reservado
  cab.writeUInt16LE(1, 2);              // 1 = icono
  cab.writeUInt16LE(entradas.length, 4);

  let offset = 6 + entradas.length * 16;
  const dir = [];
  for (const { tam, png } of entradas) {
    const e = Buffer.alloc(16);
    e[0] = tam >= 256 ? 0 : tam;        // 0 significa 256
    e[1] = tam >= 256 ? 0 : tam;
    e[2] = 0;                           // paleta
    e[3] = 0;                           // reservado
    e.writeUInt16LE(1, 4);              // planos
    e.writeUInt16LE(32, 6);             // bits por pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    dir.push(e);
  }
  return Buffer.concat([cab, ...dir, ...entradas.map((e) => e.png)]);
}

// ------------------------------------------------------------------ salidas
const SALIDAS = [
  // iconos web, en la raíz del sitio
  { archivo: "favicon-16x16.png", tam: 16, modo: "placa", fondo: MAGENTA, marca: BLANCO },
  { archivo: "favicon-32x32.png", tam: 32, modo: "placa", fondo: MAGENTA, marca: BLANCO },
  { archivo: "favicon-48x48.png", tam: 48, modo: "placa", fondo: MAGENTA, marca: BLANCO },
  { archivo: "apple-touch-icon.png", tam: 180, modo: "lleno", fondo: MAGENTA, marca: BLANCO },
  { archivo: "icon-192.png", tam: 192, modo: "lleno", fondo: MAGENTA, marca: BLANCO },
  { archivo: "icon-512.png", tam: 512, modo: "lleno", fondo: MAGENTA, marca: BLANCO },
  // originales de marca
  { archivo: "brand/isotipo-magenta-1024.png", tam: 1024, modo: "placa", fondo: MAGENTA, marca: BLANCO },
  { archivo: "brand/isotipo-tinta-1024.png", tam: 1024, modo: "placa", fondo: TINTA, marca: BLANCO },
  { archivo: "brand/isotipo-blanco-calado-1024.png", tam: 1024, modo: "calado", fondo: BLANCO },
  { archivo: "brand/isotipo-tinta-calado-1024.png", tam: 1024, modo: "calado", fondo: TINTA },
  { archivo: "brand/perfil-redes-1000.png", tam: 1000, modo: "lleno", fondo: MAGENTA, marca: BLANCO },
];

const paraIco = [16, 32, 48];
const guardadosIco = [];

for (const { archivo, tam, ...opts } of SALIDAS) {
  const png = codificarPng(tam, rasterizar(tam, opts));
  mkdirSync(dirname(join(".", archivo)), { recursive: true });
  writeFileSync(archivo, png);
  console.log(`${archivo.padEnd(42)} ${tam}x${tam}  ${(png.length / 1024).toFixed(1)} kB`);
  if (opts.modo === "placa" && paraIco.includes(tam)) guardadosIco.push({ tam, png });
}

guardadosIco.sort((a, b) => a.tam - b.tam);
const ico = codificarIco(guardadosIco);
writeFileSync("favicon.ico", ico);
console.log(`${"favicon.ico".padEnd(42)} ${guardadosIco.map((e) => e.tam).join("/")}  ${(ico.length / 1024).toFixed(1)} kB`);
