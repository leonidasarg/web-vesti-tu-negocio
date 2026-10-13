/** Rasteriza los lockups a PNG leyendo los SVG ya generados en brand/. */
import { readFileSync, writeFileSync } from "node:fs";
import {
  contornosDePath, contornoRectRedondeado, contornoCirculo,
  componerCapas, codificarPng,
} from "./lib-raster.mjs";

const BRAND = "brand";

/** Lee el SVG generado y reconstruye sus capas. */
function leerLockup(archivo) {
  const svg = readFileSync(`${BRAND}/${archivo}`, "utf8");
  const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  const iso = svg.match(/translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.]+)\)/);
  const textos = [...svg.matchAll(/<path fill="(#[0-9A-F]{6})" d="([^"]+)" transform="translate\(([\d.-]+) ([\d.-]+)\)"\/>/gi)];
  return { w, h, iso: iso && { x: +iso[1], y: +iso[2], k: +iso[3] }, textos };
}

function capasIsotipo({ x, y, k }, calado, color) {
  const T = (cx, cy, r) => contornoCirculo(x + cx * k, y + cy * k, r * k);
  const uve = [[8.6, 10.8], [13.5, 10.8], [16, 16.2], [18.5, 10.8], [23.4, 10.8], [16, 24.6]]
    .map(([px, py]) => [x + px * k, y + py * k]);
  const placa = contornoRectRedondeado(x + 1.5 * k, y + 1.5 * k, 29 * k, 29 * k, 7 * k);

  if (calado) {
    // un solo color: la marca son agujeros, todo en un contorno con nonzero
    // invertido -> se logra recorriendo los huecos al revés
    return [{ contornos: [placa, T(8, 8, 1.9).reverse(), uve.slice().reverse()], color }];
  }
  return [
    { contornos: [placa], color: "#D6006E" },
    { contornos: [T(8, 8, 1.9), uve], color: "#FFFFFF" },
  ];
}

function render(archivo, salida, escala, { calado = false, colorUnico = null, fondo = null } = {}) {
  const { w, h, iso, textos } = leerLockup(archivo);
  const W = Math.round(w * escala), H = Math.round(h * escala);

  const capas = [];
  if (iso) capas.push(...capasIsotipo({ x: iso.x * escala, y: iso.y * escala, k: iso.k * escala }, calado, colorUnico || "#D6006E"));
  for (const [, color, d, tx, ty] of textos) {
    capas.push({
      contornos: contornosDePath(d, +tx * escala, +ty * escala, escala),
      color: colorUnico || color,
    });
  }

  const png = codificarPng(W, H, componerCapas(capas, W, H, fondo));
  writeFileSync(`${BRAND}/${salida}`, png);
  console.log(`${salida.padEnd(38)} ${W}x${H}  ${(png.length / 1024).toFixed(1)} kB`);
}

const VB = (f) => { const m = readFileSync(`${BRAND}/${f}`, "utf8").match(/viewBox="0 0 ([0-9.]+) /); return +m[1]; };
render("logo-horizontal.svg", "logo-horizontal-2000.png", 2000 / VB("logo-horizontal.svg"));
render("logo-horizontal-blanco.svg", "logo-horizontal-blanco-2000.png", 2000 / VB("logo-horizontal-blanco.svg"), { calado: true, colorUnico: "#FFFFFF" });
render("logo-vertical.svg", "logo-vertical-1400.png", 1400 / VB("logo-vertical.svg"));
render("logo-wordmark.svg", "logo-wordmark-2000.png", 2000 / VB("logo-wordmark.svg"));
