// Grunge brush edge (distressed border mask): the image breaks up into rough chips, smoke,
// scuffs, scratches and cracks, and ends in a transparent background. Used by the admin
// when uploading a design, to get a print-ready PNG for DTF. The rendering runs in a web worker
// (grunge-editor/grunge.worker.ts) on OffscreenCanvas: the page stays responsive while it works
import { MAX_UPLOAD_MB } from './image-upload';

export type GrungePreset =
  | 'spray'
  | 'chipped'
  | 'smoky'
  | 'cracked'
  | 'dust'
  | 'torn'
  | 'splatter'
  | 'scratched'
  | 'worn'
  | 'brush';

// The texture sliders: each preset shows only the ones that matter for it
export type GrungeOption =
  | 'grunge'
  | 'chip'
  | 'spray'
  | 'streak'
  | 'smoke'
  | 'scuffs'
  | 'scratches'
  | 'cracks';

export type GrungeSlider = 'border' | 'radius' | 'rough' | GrungeOption;

export interface GrungeParams extends Record<GrungeSlider, number> {
  smokeColor: string;
  // The smoke eats into the image instead of painting a color
  smokeClear: boolean;
  scuffColor: string;
  // The scuffs are cut out instead of painted
  scuffClear: boolean;
  // The canvas grows so the border frames the image instead of covering it
  grow: boolean;
  // Every pixel fully solid or fully clear: DTF films print semi-transparent pixels badly
  hard: boolean;
}

export const DEFAULT_GRUNGE_PARAMS: GrungeParams = {
  border: 28,
  // 0: square frame, 100: oval
  radius: 0,
  rough: 55,
  grunge: 70,
  chip: 3,
  spray: 65,
  streak: 0,
  smoke: 0,
  scuffs: 55,
  scratches: 30,
  cracks: 20,
  smokeColor: '#3a3a3a',
  smokeClear: true,
  scuffColor: '#eeeeee',
  scuffClear: true,
  grow: false,
  hard: true,
};

export const GRUNGE_SLIDERS: Record<GrungeSlider, { min: number; max: number }> = {
  border: { min: 5, max: 70 },
  radius: { min: 0, max: 100 },
  rough: { min: 0, max: 100 },
  grunge: { min: 0, max: 100 },
  chip: { min: 1, max: 10 },
  spray: { min: 0, max: 100 },
  streak: { min: 0, max: 100 },
  smoke: { min: 0, max: 100 },
  scuffs: { min: 0, max: 100 },
  scratches: { min: 0, max: 100 },
  cracks: { min: 0, max: 100 },
};

// The frame shape (border width, corner radius) is kept when switching textures
type PresetValues = Omit<Record<GrungeSlider, number>, 'border' | 'radius'>;

export const GRUNGE_PRESETS: Record<GrungePreset, { options: GrungeOption[]; values: PresetValues }> = {
  spray: {
    options: ['grunge', 'chip', 'spray', 'scuffs'],
    values: { rough: 55, grunge: 70, chip: 3, spray: 65, streak: 0, smoke: 0, scuffs: 55, scratches: 30, cracks: 20 },
  },
  chipped: {
    options: ['grunge', 'chip', 'scuffs', 'scratches'],
    values: { rough: 60, grunge: 85, chip: 6, spray: 10, streak: 0, smoke: 0, scuffs: 35, scratches: 35, cracks: 30 },
  },
  smoky: {
    options: ['smoke', 'spray', 'grunge'],
    values: { rough: 45, grunge: 40, chip: 3, spray: 45, streak: 0, smoke: 80, scuffs: 15, scratches: 15, cracks: 0 },
  },
  cracked: {
    options: ['cracks', 'scratches', 'grunge'],
    values: { rough: 50, grunge: 55, chip: 4, spray: 25, streak: 0, smoke: 30, scuffs: 20, scratches: 60, cracks: 85 },
  },
  dust: {
    options: ['spray', 'grunge'],
    values: { rough: 35, grunge: 30, chip: 2, spray: 85, streak: 0, smoke: 0, scuffs: 0, scratches: 0, cracks: 0 },
  },
  torn: {
    options: ['grunge', 'chip'],
    values: { rough: 100, grunge: 60, chip: 8, spray: 5, streak: 0, smoke: 0, scuffs: 0, scratches: 0, cracks: 0 },
  },
  splatter: {
    options: ['grunge', 'chip', 'scuffs'],
    values: { rough: 40, grunge: 100, chip: 9, spray: 15, streak: 0, smoke: 0, scuffs: 75, scratches: 0, cracks: 0 },
  },
  scratched: {
    options: ['scratches', 'grunge', 'spray'],
    values: { rough: 45, grunge: 35, chip: 3, spray: 30, streak: 0, smoke: 0, scuffs: 10, scratches: 100, cracks: 10 },
  },
  worn: {
    options: ['spray', 'scuffs', 'chip'],
    values: { rough: 40, grunge: 50, chip: 1, spray: 100, streak: 0, smoke: 0, scuffs: 85, scratches: 15, cracks: 0 },
  },
  brush: {
    options: ['streak', 'grunge', 'spray'],
    values: { rough: 50, grunge: 30, chip: 3, spray: 20, streak: 85, smoke: 0, scuffs: 0, scratches: 10, cracks: 0 },
  },
};

export const GRUNGE_PRESET_NAMES = Object.keys(GRUNGE_PRESETS) as GrungePreset[];

type Ctx = OffscreenCanvasRenderingContext2D;
type Source = ImageBitmap | OffscreenCanvas;

const mk = (w: number, h: number) => new OffscreenCanvas(w, h);
const ctx2d = (c: OffscreenCanvas) => c.getContext('2d', { willReadFrequently: true })!;
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// Seeded random numbers (mulberry32): the same seed gives the same texture
function rng(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, s: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Messages between the editor and its worker
export type GrungeRequest =
  // The image to work on, already capped to MAX_IMAGE_SIDE
  | { type: 'source'; bitmap: ImageBitmap }
  // Renders an image area whose longest side is at most max
  | { type: 'preview'; id: number; max: number; params: GrungeParams; seed: number }
  | { type: 'export'; id: number; params: GrungeParams; seed: number; name: string };

export type GrungeResponse =
  | { type: 'preview'; id: number; bitmap: ImageBitmap }
  | { type: 'export'; id: number; file: File | null };

// Decodes the picked file on the page (SVGs can't be decoded in a worker), its longest side capped to maxSide
export async function loadGrungeSource(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    // An SVG without width / height has no natural size
    const w = img.naturalWidth || 1024;
    const h = img.naturalHeight || 1024;
    const k = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Size of the image area for an output whose longest side is at most max
export function fitSize(src: { width: number; height: number }, max: number): [number, number] {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  return [Math.max(1, Math.round(src.width * k)), Math.max(1, Math.round(src.height * k))];
}

export class GrungeRenderer {
  // Noise fields are the slow part: kept while only the sliders change. Without cache for
  // the full-size export: its fields weigh tens of MB each
  private noiseCache = new Map<string, Float32Array>();

  constructor(private cacheSize = 16) {}

  clearCache() {
    this.noiseCache.clear();
  }

  // Renders the effect for an image area of w × h. The border is always transparent
  render(src: Source, w: number, h: number, p: GrungeParams, seed: number): OffscreenCanvas {
    const pad = p.grow ? Math.round(((Math.min(w, h) * p.border) / 100) * 0.32) : 0;
    const W = w + pad * 2,
      H = h + pad * 2,
      S = Math.min(W, H);
    const out = mk(W, H),
      g = ctx2d(out);
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, pad, pad, w, h);

    const img = g.getImageData(0, 0, W, H),
      d = img.data;
    const k = (11 - p.chip) / 5;
    const nEdge = this.fbm(W, H, S, [3, 6, 13, 27, 55], [0.42, 0.26, 0.15, 0.1, 0.07], seed);
    const nChip = this.fbm(W, H, S, [30, 70, 150].map((c) => Math.round(c * k)), [0.5, 0.3, 0.2], seed * 13 + 5);
    // Brush streaks: noise stretched along each edge (vertical strokes on the sides, horizontal on top and bottom)
    const st = p.streak / 100;
    const nStrV = st > 0 ? this.fbm(W, H, S, [50, 120], [0.6, 0.4], seed * 23 + 7, 1, 0.06) : null;
    const nStrH = st > 0 ? this.fbm(W, H, S, [50, 120], [0.6, 0.4], seed * 29 + 8, 0.06, 1) : null;
    const nScuff = this.fbm(W, H, S, [8, 20, 45].map((c) => Math.round(c * k)), [0.5, 0.3, 0.2], seed * 17 + 9);
    const nSmoke = this.fbm(W, H, S, [3, 6, 12, 24, 48], [0.4, 0.27, 0.17, 0.1, 0.06], seed * 7 + 3);

    const B = Math.max(4, (S * 0.5 * p.border) / 100);
    // Where the solid image begins
    const T = 0.55;
    const rough = p.rough / 100,
      gr = p.grunge / 100,
      wh = p.scuffs / 100,
      sp = p.spray / 100,
      sm = p.smoke / 100;
    const [kr, kg, kb] = hexRgb(p.smokeColor);
    const [wr, wg, wb] = hexRgb(p.scuffColor).map((v) => v * 255);
    const zone = new Uint8ClampedArray(W * H);

    // Frame shape: a superellipse |u|^n + |v|^n = 1 over the image, from a square (n → ∞) to an
    // oval (n = 2). Its distance is measured in pixels, so the border keeps one width on every side
    const round = p.radius > 0;
    const n = 2 * Math.pow(2, (1 - p.radius / 100) ** 2 * 5);
    const hw = W / 2,
      hh = H / 2;
    // Per column: |u|^n and |u|^(n-1); the rows' values are computed once per row
    const colN = new Float64Array(W),
      colN1 = new Float64Array(W);
    if (round)
      for (let x = 0; x < W; x++) {
        const u = Math.abs(x + 0.5 - hw) / hw;
        colN1[x] = Math.pow(u, n - 1);
        colN[x] = colN1[x] * u;
      }

    for (let y = 0; y < H; y++) {
      const dy = Math.min(y, H - 1 - y) / B;
      const rv = Math.abs(y + 0.5 - hh) / hh,
        rowN1 = round ? Math.pow(rv, n - 1) : 0,
        rowN = rowN1 * rv;
      for (let x = 0; x < W; x++) {
        const i = y * W + x,
          o = i * 4;
        const dx = Math.min(x, W - 1 - x) / B;
        // Distance to the frame in border widths, and whether the nearest edge is a side
        let t: number, side: boolean;
        if (!round) {
          t = Math.min(dx, dy);
          side = dx < dy;
        } else {
          const sum = colN[x] + rowN;
          if (sum === 0) {
            // Centre of the image: far from any edge
            t = 1e9;
            side = true;
          } else {
            // f = sum^(1/n) and f^(n-1), from one pow; distance ≈ (1 - f) / |∇f|
            const fn1 = Math.pow(sum, (n - 1) / n),
              f = sum / fn1;
            const gx = colN1[x] / fn1 / hw,
              gy = rowN1 / fn1 / hh;
            t = (1 - f) / Math.sqrt(gx * gx + gy * gy) / B;
            side = gx > gy;
          }
        }
        const e = t + (nEdge[i] - 0.5) * 1.8 * rough;
        zone[i] = 255 * clamp(1.5 - e);
        // Untouched centre
        if (e > 1.6) continue;
        const hz = hash(x, y, seed);
        // Grunge brush: chip noise pushes the cut line in and out, leaving islands and holes
        let v = e + (nChip[i] - 0.5) * 1.4 * gr + (hz - 0.5) * (0.1 + 0.9 * sp);
        if (nStrV && nStrH) v += ((side ? nStrV[i] : nStrH[i]) - 0.5) * 1.6 * st;
        // Scuffs: pale paint flecks near the cut line, on the image and just outside it
        const s = nScuff[i] + (nChip[i] - 0.5) * 0.7 + (hash(y, x, seed + 3) - 0.5) * (0.2 + 0.8 * sp);
        const near = v > T ? 1 - (v - T) / 0.28 : 1 - (T - v) / 0.4;
        if (v > T) {
          if (wh > 0 && near > 0 && s > 1 - 0.5 * wh * near) {
            if (p.scuffClear) d[o + 3] = 0;
            else {
              const shade = 0.88 + 0.12 * nChip[i];
              d[o] = wr * shade;
              d[o + 1] = wg * shade;
              d[o + 2] = wb * shade;
            }
          }
        } else if (!p.scuffClear && wh > 0 && near > 0.55 && s > 1 - 0.22 * wh * near) {
          d[o] = wr;
          d[o + 1] = wg;
          d[o + 2] = wb;
          d[o + 3] = 255;
        } else {
          d[o + 3] = 0;
        }

        // Smoke clouds: haze rolling over the cut line and out into the transparent border
        if (sm > 0) {
          const q = (v - T + 0.1) / 0.6;
          const den = Math.min(
            1,
            sm *
              1.25 *
              Math.exp(-q * q) *
              smooth(0, 0.3, t) *
              smooth(0.2, 0.72, nSmoke[i] + (hash(x, y, seed + 5) - 0.5) * 0.15),
          );
          if (den > 0.003) {
            if (p.smokeClear) {
              d[o + 3] *= 1 - den;
              continue;
            }
            const lt = smooth(0.45, 0.9, nScuff[i]) * 0.7;
            const cr = (kr + (0.78 - kr) * lt) * 255,
              cg = (kg + (0.78 - kg) * lt) * 255,
              cb = (kb + (0.78 - kb) * lt) * 255;
            const A0 = d[o + 3] / 255,
              A1 = A0 + den * (1 - A0),
              w0 = (A0 * (1 - den)) / A1,
              w1 = den / A1;
            d[o] = d[o] * w0 + cr * w1;
            d[o + 1] = d[o + 1] * w0 + cg * w1;
            d[o + 2] = d[o + 2] * w0 + cb * w1;
            d[o + 3] = A1 * 255;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    drawMarks(g, W, H, S, zone, p, seed);
    if (p.hard) hardAlpha(g, W, H, seed);
    return out;
  }

  // Fractal value noise built by upscaling small random grids. Cell counts are relative to the
  // short side, so the same seed gives the same texture at preview and export size
  private fbm(W: number, H: number, S: number, cells: number[], amps: number[], s: number, sx = 1, sy = 1) {
    const key = [W, H, s, cells.join(), sx, sy].join(':');
    const cached = this.noiseCache.get(key);
    if (cached) return cached;
    const R = rng(s),
      acc = new Float32Array(W * H),
      c = mk(W, H),
      g = ctx2d(c);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    let tot = 0;
    cells.forEach((cc, k) => {
      const cw = Math.max(2, Math.round((cc * sx * W) / S)) + 1,
        ch = Math.max(2, Math.round((cc * sy * H) / S)) + 1;
      const t = mk(cw, ch),
        tg = t.getContext('2d')!,
        id = tg.createImageData(cw, ch);
      for (let i = 0; i < cw * ch; i++) {
        id.data[i * 4] = R() * 255;
        id.data[i * 4 + 3] = 255;
      }
      tg.putImageData(id, 0, 0);
      g.drawImage(t, 0.5, 0.5, cw - 1, ch - 1, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;
      for (let i = 0; i < W * H; i++) acc[i] += (d[i * 4] / 255) * amps[k];
      tot += amps[k];
    });
    for (let i = 0; i < W * H; i++) acc[i] = clamp((acc[i] / tot - 0.5) * 2.6 + 0.5);
    if (!this.cacheSize) return acc;
    // Drops the oldest field: the edge and smoke ones, shared by every texture, stay warm
    if (this.noiseCache.size >= this.cacheSize) this.noiseCache.delete(this.noiseCache.keys().next().value!);
    this.noiseCache.set(key, acc);
    return acc;
  }
}

// Random-threshold dithering keeps soft smoke looking soft as fine grain, without a dot pattern
function hardAlpha(g: Ctx, W: number, H: number, seed: number) {
  const img = g.getImageData(0, 0, W, H),
    d = img.data;
  for (let y = 0, o = 3; y < H; y++)
    for (let x = 0; x < W; x++, o += 4) {
      const a = d[o];
      if (a === 0 || a === 255) continue;
      d[o] = a / 255 > 0.08 + 0.84 * hash(x, y, seed + 11) ? 255 : 0;
    }
  g.putImageData(img, 0, 0);
}

// A random point whose zone value falls inside [lo, hi]
function pick(R: () => number, W: number, H: number, zone: Uint8ClampedArray, lo: number, hi: number) {
  for (let k = 0; k < 40; k++) {
    const x = (R() * W) | 0,
      y = (R() * H) | 0,
      z = zone[y * W + x];
    if (z >= lo && z <= hi) return [x, y];
  }
  return null;
}

function drawMarks(
  g: Ctx,
  W: number,
  H: number,
  S: number,
  zone: Uint8ClampedArray,
  p: GrungeParams,
  seed: number,
) {
  // Pale scratches are painted on `o`; cracks and dark scratches on `c` cut through to the shirt
  const ov = mk(W, H),
    o = ov.getContext('2d')!,
    cv = mk(W, H),
    c = cv.getContext('2d')!;
  o.lineCap = c.lineCap = 'round';
  const u = S / 1000;

  const Rs = rng(seed * 31 + 1),
    nS = Math.round(p.scratches * 1.4);
  for (let k = 0; k < nS; k++) {
    const pt = pick(Rs, W, H, zone, 70, 255);
    if (!pt) continue;
    const len = S * (0.03 + Rs() * 0.16),
      a = Rs() * Math.PI * 2,
      bend = (Rs() - 0.5) * len * 0.25;
    const x2 = pt[0] + Math.cos(a) * len,
      y2 = pt[1] + Math.sin(a) * len;
    const mx = (pt[0] + x2) / 2 - Math.sin(a) * bend,
      my = (pt[1] + y2) / 2 + Math.cos(a) * bend;
    const t = Rs() < 0.7 ? o : c;
    t.strokeStyle = t === o ? p.scuffColor : '#000';
    t.lineWidth = Math.max(1, u * (0.8 + Rs() * 1.8));
    t.beginPath();
    t.moveTo(pt[0], pt[1]);
    t.quadraticCurveTo(mx, my, x2, y2);
    t.stroke();
  }

  const Rc = rng(seed * 47 + 2),
    nC = Math.round((p.cracks / 100) * 16);
  const crack = (x: number, y: number, ang: number, steps: number, w0: number) => {
    const pts = [[x, y]];
    for (let s = 0; s < steps; s++) {
      ang += (Rc() - 0.5) * 0.9;
      const step = S * (0.006 + Rc() * 0.012);
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      pts.push([x, y]);
      if (Rc() < 0.07 && steps > 8)
        crack(x, y, ang + (Rc() < 0.5 ? -1 : 1) * (0.5 + Rc() * 0.8), (steps * 0.45) | 0, w0 * 0.6);
    }
    c.strokeStyle = '#000';
    for (let s = 1; s < pts.length; s++) {
      const taper = 1 - s / pts.length,
        [ax, ay] = pts[s - 1],
        [bx, by] = pts[s];
      c.lineWidth = Math.max(1, w0 * u * (0.4 + taper));
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
    }
  };
  for (let k = 0; k < nC; k++) {
    const pt = pick(Rc, W, H, zone, 110, 240);
    if (!pt) continue;
    crack(pt[0], pt[1], Rc() * Math.PI * 2, (18 + Rc() * 40) | 0, 2.2 + Rc() * 1.8);
  }

  // Fade the marks out toward the clean centre, then keep pale marks only where there is image
  const zc = mk(W, H),
    zg = zc.getContext('2d')!,
    zd = zg.createImageData(W, H);
  for (let i = 0; i < W * H; i++) zd.data[i * 4 + 3] = zone[i];
  zg.putImageData(zd, 0, 0);
  o.globalCompositeOperation = c.globalCompositeOperation = 'destination-in';
  o.drawImage(zc, 0, 0);
  c.drawImage(zc, 0, 0);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(cv, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.drawImage(ov, 0, 0);
  g.restore();
}

// The full-size PNG to upload. A large PNG with fine grain can outweigh the server limit:
// rendered smaller until it fits
export async function renderGrungeFile(src: Source, p: GrungeParams, seed: number, name: string): Promise<File | null> {
  const fileName = `${name.replace(/\.[^.]+$/, '') || 'design'}-grunge.png`;
  const renderer = new GrungeRenderer(0);
  const side = Math.max(src.width, src.height);
  for (const max of [side, ...[3072, 2048, 1536].filter((m) => m < side)]) {
    const [w, h] = fitSize(src, max);
    const out = renderer.render(src, w, h, p, seed);
    const blob = await out.convertToBlob({ type: 'image/png' });
    out.width = out.height = 0;
    if (blob.size <= MAX_UPLOAD_MB * 1024 * 1024) return new File([blob], fileName, { type: 'image/png' });
  }
  return null;
}
