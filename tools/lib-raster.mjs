/** Rasterizador de contornos + codificador PNG, sin dependencias. */
import { deflateSync } from "node:zlib";

// ------------------------------------------------------ aplanado de curvas
const PASOS = 16;

function cuadratica(p0, p1, p2, salida) {
  for (let i = 1; i <= PASOS; i++) {
    const t = i / PASOS, u = 1 - t;
    salida.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
}

function cubica(p0, p1, p2, p3, salida) {
  for (let i = 1; i <= PASOS; i++) {
    const t = i / PASOS, u = 1 - t;
    salida.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
}

/** Convierte el path data de opentype.js (M/L/Q/C/Z absolutos) en contornos. */
export function contornosDePath(d, tx = 0, ty = 0, s = 1) {
  const contornos = [];
  let actual = null, pos = [0, 0];
  const num = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

  for (const [, cmd, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/gi)) {
    const n = (args.match(num) || []).map(Number).map((v, i) =>
      i % 2 === 0 ? v * s + tx : v * s + ty);

    switch (cmd.toUpperCase()) {
      case "M":
        if (actual && actual.length > 2) contornos.push(actual);
        actual = [[n[0], n[1]]];
        pos = [n[0], n[1]];
        break;
      case "L":
        for (let i = 0; i < n.length; i += 2) { actual.push([n[i], n[i + 1]]); pos = [n[i], n[i + 1]]; }
        break;
      case "Q":
        for (let i = 0; i < n.length; i += 4) {
          cuadratica(pos, [n[i], n[i + 1]], [n[i + 2], n[i + 3]], actual);
          pos = [n[i + 2], n[i + 3]];
        }
        break;
      case "C":
        for (let i = 0; i < n.length; i += 6) {
          cubica(pos, [n[i], n[i + 1]], [n[i + 2], n[i + 3]], [n[i + 4], n[i + 5]], actual);
          pos = [n[i + 4], n[i + 5]];
        }
        break;
      case "Z":
        if (actual && actual.length > 2) contornos.push(actual);
        actual = null;
        break;
    }
  }
  if (actual && actual.length > 2) contornos.push(actual);
  return contornos;
}

// ------------------------------------------------- contornos geométricos
export function contornoRectRedondeado(x, y, w, h, r, segs = 20) {
  const p = [];
  const esquina = (cx, cy, desde) => {
    for (let i = 0; i <= segs; i++) {
      const a = desde + (Math.PI / 2) * (i / segs);
      p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  esquina(x + w - r, y + h - r, 0);              // abajo-derecha
  esquina(x + r, y + h - r, Math.PI / 2);        // abajo-izquierda
  esquina(x + r, y + r, Math.PI);                // arriba-izquierda
  esquina(x + w - r, y + r, (3 * Math.PI) / 2);  // arriba-derecha
  return p;
}

export function contornoCirculo(cx, cy, r, segs = 64) {
  const p = [];
  for (let i = 0; i < segs; i++) {
    const a = (2 * Math.PI * i) / segs;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
}

// ------------------------------------------- relleno por líneas de barrido
const SUBY = 5; // sub-líneas por fila de pixeles

/** Cobertura 0..1 por pixel, regla nonzero. */
export function cobertura(contornos, W, H) {
  const cov = new Float32Array(W * H);
  const aristas = [];
  for (const c of contornos) {
    for (let i = 0; i < c.length; i++) {
      const [x1, y1] = c[i], [x2, y2] = c[(i + 1) % c.length];
      if (y1 === y2) continue;
      aristas.push({ x1, y1, x2, y2, dir: y2 > y1 ? 1 : -1, ymin: Math.min(y1, y2), ymax: Math.max(y1, y2) });
    }
  }

  for (let fila = 0; fila < H; fila++) {
    for (let k = 0; k < SUBY; k++) {
      const ys = fila + (k + 0.5) / SUBY;
      const cortes = [];
      for (const e of aristas) {
        if (ys >= e.ymin && ys < e.ymax) {
          cortes.push({ x: e.x1 + ((ys - e.y1) * (e.x2 - e.x1)) / (e.y2 - e.y1), dir: e.dir });
        }
      }
      if (cortes.length < 2) continue;
      cortes.sort((a, b) => a.x - b.x);

      let giro = 0;
      for (let i = 0; i < cortes.length - 1; i++) {
        giro += cortes[i].dir;
        if (giro === 0) continue;
        let xa = Math.max(cortes[i].x, 0), xb = Math.min(cortes[i + 1].x, W);
        if (xb <= xa) continue;
        const p0 = Math.floor(xa), p1 = Math.floor(xb - 1e-9);
        if (p0 === p1) {
          cov[fila * W + p0] += (xb - xa) / SUBY;
        } else {
          cov[fila * W + p0] += (p0 + 1 - xa) / SUBY;
          for (let p = p0 + 1; p < p1; p++) cov[fila * W + p] += 1 / SUBY;
          cov[fila * W + p1] += (xb - p1) / SUBY;
        }
      }
    }
  }
  return cov;
}

function hexARgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Compone capas {contornos, color} una sobre otra. */
export function componerCapas(capas, W, H, fondo = null) {
  const img = Buffer.alloc(W * H * 4);
  if (fondo) {
    const [r, g, b] = hexARgb(fondo);
    for (let i = 0; i < W * H; i++) { img[i * 4] = r; img[i * 4 + 1] = g; img[i * 4 + 2] = b; img[i * 4 + 3] = 255; }
  }
  for (const { contornos, color } of capas) {
    const [r, g, b] = hexARgb(color);
    const cov = cobertura(contornos, W, H);
    for (let i = 0; i < W * H; i++) {
      const a = Math.min(cov[i], 1);
      if (a <= 0) continue;
      const j = i * 4, ad = img[j + 3] / 255, af = a + ad * (1 - a);
      img[j] = Math.round((r * a + img[j] * ad * (1 - a)) / af);
      img[j + 1] = Math.round((g * a + img[j + 1] * ad * (1 - a)) / af);
      img[j + 2] = Math.round((b * a + img[j + 2] * ad * (1 - a)) / af);
      img[j + 3] = Math.round(af * 255);
    }
  }
  return img;
}

// ------------------------------------------------------------------- PNG
const TABLA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();

function crc32(buf) { let c = -1; for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }

function trozo(tipo, datos) {
  const l = Buffer.alloc(4); l.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([l, cuerpo, c]);
}

export function codificarPng(W, H, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const crudo = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    crudo[y * (W * 4 + 1)] = 0;
    px.copy(crudo, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(crudo, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}
