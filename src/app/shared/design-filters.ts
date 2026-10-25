// Print effects of an image design. They are baked into the image pixels (the DOM captures
// can't render CSS filters). The wear comes from a seeded texture sized on the image's longest side:
// the same filter gives the same result at any resolution, in the designer and for the print shop
export type DesignFilterType = 'none' | 'distressed' | 'blackWhite';

export type DesignFilter = {
  type: DesignFilterType;
};

export const DESIGN_FILTERS: DesignFilterType[] = [
  'none',
  'distressed',
  'blackWhite',
];

// Longest side the designer works at: sharp on the canvas and in the previews
export const DESIGNER_FILTER_SIZE = 1600;
// Longest side of the file given to the print shop
export const PRINT_FILTER_SIZE = 3500;

export const hasFilter = (
  filter?: DesignFilter | null,
): filter is DesignFilter => !!filter && filter.type !== 'none';

// Filtered images kept, all sources together
const CACHE_SIZE = 16;
// Source url -> "type|size" -> object url of the filtered image. Keyed by the source
// string itself: base64 sources are megabytes, a combined key would copy them
const cache = new Map<string, Map<string, Promise<string>>>();
// Oldest first, for the eviction
const cacheOrder: [src: string, key: string][] = [];
// Every object url made, released with releaseDesignFilters
const objectUrls = new Set<string>();

// Object url of the filtered image as a PNG. Evicted urls are not revoked:
// the canvas or the undo history may still show them
export const applyDesignFilter = (
  src: string,
  filter: DesignFilter,
  maxSize = DESIGNER_FILTER_SIZE,
): Promise<string> => {
  const key = `${filter.type}|${maxSize}`;
  let bySource = cache.get(src);
  let result = bySource?.get(key);
  if (result) return result;

  result = render(src, filter, maxSize).then((url) => {
    objectUrls.add(url);
    return url;
  });
  if (!bySource) cache.set(src, (bySource = new Map()));
  bySource.set(key, result);
  cacheOrder.push([src, key]);
  result.catch(() => forget(src, key));
  if (cacheOrder.length > CACHE_SIZE) forget(...cacheOrder[0]);
  return result;
};

// The designer was cleared: nothing shows the filtered images anymore
export const releaseDesignFilters = () => {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
  cache.clear();
  cacheOrder.length = 0;
  noiseCache.clear();
};

const forget = (src: string, key: string) => {
  const index = cacheOrder.findIndex(([s, k]) => s === src && k === key);
  if (index >= 0) cacheOrder.splice(index, 1);
  const bySource = cache.get(src);
  bySource?.delete(key);
  if (bySource?.size === 0) cache.delete(src);
};

// Uncached render, e.g. a print file downloaded once: the caller revokes the object url
export const renderDesignFilter = (
  src: string,
  filter: DesignFilter,
  maxSize: number,
): Promise<string> => render(src, filter, maxSize);

const render = async (
  src: string,
  filter: DesignFilter,
  maxSize: number,
): Promise<string> => {
  const img = await loadImage(src);
  const width = img.naturalWidth || 500;
  const height = img.naturalHeight || 500;
  // SVGs are redrawn at the target size, rasters are never upscaled
  const isSvg = /^data:image\/svg|\.svg($|\?)/i.test(src);
  const scale = isSvg
    ? maxSize / Math.max(width, height)
    : Math.min(1, maxSize / Math.max(width, height));
  const canvas = makeCanvas(
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
  );
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  filterCanvas(canvas, filter.type);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  // Frees the pixels now rather than at the next GC
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('Failed to encode the filtered image');
  return URL.createObjectURL(blob);
};

// Applies the filter to the canvas pixels, in place (also used for the texts)
export const filterCanvas = (
  canvas: HTMLCanvasElement,
  type: DesignFilterType,
) => {
  if (type === 'distressed') distress(canvas);
  if (type === 'blackWhite') blackWhite(canvas);
};

// Wear thresholds: a noise value above them erases the ink
const GRAIN_AT = 0.76;
const SPECK_AT = 0.79;
const STREAK_AT = 0.8;
const EDGE = 0.012;

// Worn screen print: the ink is eaten evenly over the whole design by fine grain,
// small specks and short scratches, denser in some places than others.
// Only erases (alpha), never recolors
const distress = (canvas: HTMLCanvasElement) => {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const { density, grain, specks, streaks } = wearTexture(w, h);

  for (let p = 0, i = 3; p < density.length; p++, i += 4) {
    if (data[i] === 0) continue;
    // -0.5..0.5: positive where the print is more worn
    const d = density[p] / 255 - 0.5;
    const grainHole = smoothstep(GRAIN_AT, GRAIN_AT + EDGE, grain[p] / 255 + d * 0.5);
    const speckHole = smoothstep(SPECK_AT, SPECK_AT + EDGE, specks[p] / 255 + d * 0.4);
    const streakHole = smoothstep(STREAK_AT, STREAK_AT + EDGE, streaks[p] / 255 + d * 0.3);
    data[i] *= (1 - grainHole) * (1 - speckHole) * (1 - streakHole);
  }
  ctx.putImageData(image, 0, 0);
};

// Grayscale
const blackWhite = (canvas: HTMLCanvasElement) => {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    data[i] = data[i + 1] = data[i + 2] =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  ctx.putImageData(image, 0, 0);
};

type WearTexture = Record<'density' | 'grain' | 'specks' | 'streaks', Uint8Array>;

// The texture only depends on the size: designs of the same size, and the same
// design filtered again, reuse it. Two sizes kept (a few MB each in the designer)
const NOISE_CACHE_SIZE = 2;
const noiseCache = new Map<string, WearTexture>();

const wearTexture = (w: number, h: number): WearTexture => {
  const key = `${w}x${h}`;
  let texture = noiseCache.get(key);
  if (texture) {
    // Most recently used last
    noiseCache.delete(key);
    noiseCache.set(key, texture);
    return texture;
  }
  texture = {
    // Where the wear is denser, the fine grain, the small specks, and long thin streaks
    density: fractalNoise(w, h, { cells: 8, octaves: 3, seed: 101 }),
    grain: fractalNoise(w, h, { cells: 300, octaves: 2, seed: 202 }),
    specks: fractalNoise(w, h, { cells: 90, octaves: 3, seed: 303 }),
    streaks: fractalNoise(w, h, {
      cells: 280,
      octaves: 2,
      seed: 404,
      stretch: 12,
      angle: -0.3,
    }),
  };
  // Print-size textures are made once per download: not worth keeping tens of MB
  if (w * h > DESIGNER_FILTER_SIZE ** 2) return texture;
  noiseCache.set(key, texture);
  if (noiseCache.size > NOISE_CACHE_SIZE) {
    noiseCache.delete(noiseCache.keys().next().value!);
  }
  return texture;
};

type NoiseOptions = {
  // Cells across the longest side, for the first octave
  cells: number;
  octaves: number;
  seed: number;
  // Cells this many times longer than wide, for streaks
  stretch?: number;
  // Direction of the long side of the cells, in radians
  angle?: number;
};

// Fractal value noise over a w×h area, one 0..255 value per pixel.
// Each octave is a grid of random values stretched by the canvas (bilinear),
// added with half the weight of the previous one. The grids only depend on the
// options, so the texture looks the same at any resolution
const fractalNoise = (
  w: number,
  h: number,
  { cells, octaves, seed, stretch = 1, angle = 0 }: NoiseOptions,
): Uint8Array => {
  const dim = Math.max(w, h);
  // Covers the image whatever the angle
  const cover = dim * 1.5;
  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);

  const random = mulberry32(seed);
  const total = 2 - 2 ** (1 - octaves);
  for (let o = 0; o < octaves; o++) {
    const cellHeight = dim / (cells * 2 ** o);
    const cellWidth = cellHeight * stretch;
    const nx = Math.ceil(cover / cellWidth) + 1;
    const ny = Math.ceil(cover / cellHeight) + 1;
    const lattice = makeCanvas(nx, ny);
    const lctx = lattice.getContext('2d')!;
    const values = lctx.createImageData(nx, ny);
    for (let i = 0; i < values.data.length; i += 4) {
      const v = random() * 255;
      values.data[i] = values.data[i + 1] = values.data[i + 2] = v;
      values.data[i + 3] = 255;
    }
    lctx.putImageData(values, 0, 0);
    ctx.globalAlpha = 2 ** -o / total;
    ctx.drawImage(
      lattice,
      -cover / 2,
      -cover / 2,
      nx * cellWidth,
      ny * cellHeight,
    );
  }

  // Only the red channel is kept: a quarter of the RGBA memory
  const rgba = ctx.getImageData(0, 0, w, h).data;
  out.width = out.height = 0;
  const noise = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < noise.length; p++, i += 4) noise[p] = rgba[i];
  return noise;
};

const smoothstep = (from: number, to: number, x: number): number => {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

// Seeded random numbers: the texture is the same on every render
const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
