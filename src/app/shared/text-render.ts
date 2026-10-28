import { TextStyleModel } from '../models/design-object.model';
import { loadTextFonts } from './text-fonts';
import { filterCanvas } from './design-filters';

// Texts are drawn on a canvas, the same way in the designer, the 3D preview and the print sheet

export const TEXT_LINE_HEIGHT = 1.2;
// Text color of hollow letters, showing only their outline
export const TEXT_TRANSPARENT = 'transparent';
// Letters thinned (below 0) or thickened (above 0), in % of the font size.
// Regular fonts lose their thin strokes past -3
export const TEXT_THICKNESS_LIMITS = { min: -3, max: 15 };
// Outline around the letters, in px
export const TEXT_STROKE_LIMITS = { min: 0, max: 12 };
// Bend of the text: 100 makes a full circle, below 0 it bends downwards
export const TEXT_CURVE_LIMITS = { min: -100, max: 100 };
// Width or height of the letters, in % of their own
export const TEXT_STRETCH_LIMITS = { min: 50, max: 200 };
// Shadow behind the text: how far (px), which way (degrees, 90 = down), how soft (px), how strong (%)
export const TEXT_SHADOW_DISTANCE_LIMITS = { min: 0, max: 40 };
export const TEXT_SHADOW_ANGLE_LIMITS = { min: -180, max: 180 };
export const TEXT_SHADOW_BLUR_LIMITS = { min: 0, max: 30 };
export const TEXT_SHADOW_OPACITY_LIMITS = { min: 0, max: 100 };
export const TEXT_SHADOW_DEFAULTS = {
  shadowAngle: 45,
  shadowOpacity: 50,
  shadowColor: '#000000',
};

type Size = { width: number; height: number };
type Flat = Size & { canvas: HTMLCanvasElement };
type Line = { content: string; x: number; y: number; width: number };

// CSS font of a text
export const textFont = (
  text: TextStyleModel,
  fontSize = text.fontSize,
): string =>
  `${text.italic ? 'italic ' : ''}${text.bold ? 700 : 400} ${fontSize}px ${text.fontFamily}`;

// A canvas doesn't download the fonts it uses: resolves once the text's font can be drawn
export const loadTextFont = async (text: TextStyleModel): Promise<void> => {
  try {
    await loadTextFonts(document);
    await document.fonts?.load(textFont(text), text.content || undefined);
  } catch {}
};

const createCanvas = (width: number, height: number): HTMLCanvasElement =>
  sizeCanvas(document.createElement('canvas'), width, height);

// Also clears it
const sizeCanvas = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement => {
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

// Working canvases, reused by every render: a slider drag paints many times a second, and
// new canvases each time fill the GPU memory faster than they are freed (the 3D view then
// can't get a WebGL context). Renders are synchronous, so they never share one
const scratchCanvases = new Map<string, HTMLCanvasElement>();
const scratch = (
  name: 'layer' | 'flat' | 'bend' | 'shadow',
  width: number,
  height: number,
): HTMLCanvasElement => {
  let canvas = scratchCanvases.get(name);
  if (!canvas) {
    canvas = document.createElement('canvas');
    scratchCanvases.set(name, canvas);
  }
  return sizeCanvas(canvas, width, height);
};

let measureContext: CanvasRenderingContext2D | null = null;

const setTextStyle = (ctx: CanvasRenderingContext2D, text: TextStyleModel) => {
  ctx.font = textFont(text);
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = `${text.letterSpacing || 0}px`;
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
};

// Lines placed in a block starting at 0,0, and the box their letters actually cover
// (italics and script fonts go past their advance)
const layoutLines = (text: TextStyleModel) => {
  measureContext ??= createCanvas(1, 1).getContext('2d')!;
  const ctx = measureContext;
  setTextStyle(ctx, text);
  const lineHeight = text.fontSize * TEXT_LINE_HEIGHT;
  const contents = text.content.split('\n');
  const metrics = contents.map((content) => ctx.measureText(content));
  const blockWidth = Math.max(...metrics.map((m) => m.width), 0);
  const ink = {
    left: 0,
    top: 0,
    right: blockWidth,
    bottom: contents.length * lineHeight,
  };
  const lines: Line[] = contents.map((content, i) => {
    const width = metrics[i].width;
    let x = 0;
    if (text.align === 'center') x = (blockWidth - width) / 2;
    if (text.align === 'right') x = blockWidth - width;
    const y = lineHeight * (i + 0.5);
    ink.left = Math.min(ink.left, x - metrics[i].actualBoundingBoxLeft);
    ink.right = Math.max(ink.right, x + metrics[i].actualBoundingBoxRight);
    ink.top = Math.min(ink.top, y - metrics[i].actualBoundingBoxAscent);
    ink.bottom = Math.max(ink.bottom, y + metrics[i].actualBoundingBoxDescent);
    return { content, x, y, width };
  });
  return { lines, ink };
};

// The letters in one color, grown (offset > 0) or shrunk (offset < 0) by offset px on every side
const paintLetters = (
  ctx: CanvasRenderingContext2D,
  text: TextStyleModel,
  lines: Line[],
  offset: number,
  color: string,
) => {
  const underline = Math.max(1, text.fontSize / 15);
  const underlineOf = (line: Line) =>
    [
      line.x,
      line.y + text.fontSize * 0.45 - underline / 2,
      line.width,
      underline,
    ] as const;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  for (const line of lines) ctx.fillText(line.content, line.x, line.y);
  if (offset > 0) {
    ctx.lineWidth = offset * 2;
    for (const line of lines) {
      ctx.strokeText(line.content, line.x, line.y);
      if (text.underline) ctx.strokeRect(...underlineOf(line));
    }
  } else if (offset < 0) {
    // Erases the edge of the letters
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = -offset * 2;
    for (const line of lines) ctx.strokeText(line.content, line.x, line.y);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Drawn after the thinning, which would make a thin underline vanish
  if (text.underline) {
    for (const line of lines) ctx.fillRect(...underlineOf(line));
  }
};

// The text on straight lines, stretched, with its thickness and outline
const renderFlat = (text: TextStyleModel, ratio: number): Flat => {
  const { lines, ink } = layoutLines(text);
  const sx = (text.stretchX || 100) / 100;
  const sy = (text.stretchY || 100) / 100;
  // Thickness and outline are drawn stretched too: kept to the same area,
  // they spread up to this much along the stretched side
  const strokeScale = Math.sqrt(sx * sy);
  const spread = Math.max(sx, sy) / strokeScale;
  const offset = (text.fontSize * (text.thickness || 0)) / 100;
  const outline = text.strokeWidth || 0;
  // Room for what goes past the letters, and their antialiasing
  const reach =
    Math.max(0, offset, outline ? offset + outline : 0) * spread + 1;
  const flat = scratch(
    'flat',
    ((ink.right - ink.left) * sx + 2 * reach) * ratio,
    ((ink.bottom - ink.top) * sy + 2 * reach) * ratio,
  );
  // Each color on its own canvas: the thinning erases what is under it
  const layer = (layerOffset: number, color: string) => {
    const canvas = scratch('layer', flat.width, flat.height);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(
      ratio * sx,
      0,
      0,
      ratio * sy,
      (reach - ink.left * sx) * ratio,
      (reach - ink.top * sy) * ratio,
    );
    setTextStyle(ctx, text);
    paintLetters(ctx, text, lines, layerOffset / strokeScale, color);
    return canvas;
  };
  const ctx = flat.getContext('2d')!;
  // Behind the letters, so only its outer part shows
  if (outline) {
    ctx.drawImage(layer(offset + outline, text.strokeColor || '#000000'), 0, 0);
  }
  // Transparent letters cut themselves out of the outline: only the outline shows
  if (text.color === TEXT_TRANSPARENT) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(layer(offset, '#000000'), 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.drawImage(layer(offset, text.color), 0, 0);
  }
  return {
    canvas: flat,
    width: flat.width / ratio,
    height: flat.height / ratio,
  };
};

// Bends the flat text along an arc of angle radians (below 0: downwards), one pixel column at a time,
// so the letters keep their shaping and kerning (joined scripts, ligatures)
const bend = (flat: Flat, ratio: number, angle: number): Flat => {
  const { width, height } = flat;
  const k = Math.sign(angle);
  // Radius at the middle of the text: its inner side can't go past the center
  const radius = Math.max(width / Math.abs(angle), height / 2 + 1);
  const span = width / radius;
  // Top and bottom of a column, from the center of the arc before its rotation
  const top = -k * radius - height / 2;
  const bottom = top + height;

  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const psi = -span / 2 + (span * i) / steps;
    for (const y of [top, bottom]) {
      const px = -y * Math.sin(psi);
      const py = k * radius + y * Math.cos(psi);
      bounds.left = Math.min(bounds.left, px);
      bounds.right = Math.max(bounds.right, px);
      bounds.top = Math.min(bounds.top, py);
      bounds.bottom = Math.max(bounds.bottom, py);
    }
  }
  const pad = 1;
  const out = scratch(
    'bend',
    (bounds.right - bounds.left + 2 * pad) * ratio,
    (bounds.bottom - bounds.top + 2 * pad) * ratio,
  );
  const ctx = out.getContext('2d')!;
  const columns = flat.canvas.width;
  const columnWidth = width / columns;
  // Columns are drawn rigid: widened so they still touch on the outer side
  const drawnWidth =
    (columnWidth * (radius + height / 2)) / radius + 0.5 / ratio;
  for (let i = 0; i < columns; i++) {
    const x = (i + 0.5) * columnWidth - width / 2;
    ctx.setTransform(
      ratio,
      0,
      0,
      ratio,
      (pad - bounds.left) * ratio,
      (pad - bounds.top) * ratio,
    );
    ctx.translate(0, k * radius);
    ctx.rotate((k * x) / radius);
    ctx.drawImage(
      flat.canvas,
      i,
      0,
      1,
      flat.canvas.height,
      -drawnWidth / 2,
      top,
      drawnWidth,
      height,
    );
  }
  return { canvas: out, width: out.width / ratio, height: out.height / ratio };
};

export const hasTextShadow = (text: TextStyleModel): boolean =>
  !!(text.shadowDistance || text.shadowBlur) &&
  (text.shadowOpacity ?? TEXT_SHADOW_DEFAULTS.shadowOpacity) > 0;

// #rrggbb at opacity (0..1)
const withOpacity = (hex: string, opacity: number): string => {
  const value = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0;
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
};

// The text with its shadow behind it. The room is added on every side,
// so the text stays in the middle of its box whatever the direction
const addShadow = (result: Flat, text: TextStyleModel, ratio: number): Flat => {
  const distance = text.shadowDistance || 0;
  const blur = text.shadowBlur || 0;
  const angle =
    ((text.shadowAngle ?? TEXT_SHADOW_DEFAULTS.shadowAngle) * Math.PI) / 180;
  const opacity =
    (text.shadowOpacity ?? TEXT_SHADOW_DEFAULTS.shadowOpacity) / 100;
  // A canvas blur spreads about its size on each side
  const pad = distance + blur + 1;
  const out = scratch(
    'shadow',
    result.canvas.width + 2 * pad * ratio,
    result.canvas.height + 2 * pad * ratio,
  );
  const ctx = out.getContext('2d')!;
  // Shadow sizes are in canvas pixels, whatever the transform
  ctx.shadowColor = withOpacity(
    text.shadowColor || TEXT_SHADOW_DEFAULTS.shadowColor,
    opacity,
  );
  ctx.shadowBlur = blur * ratio;
  ctx.shadowOffsetX = Math.cos(angle) * distance * ratio;
  ctx.shadowOffsetY = Math.sin(angle) * distance * ratio;
  ctx.drawImage(result.canvas, pad * ratio, pad * ratio);
  return { canvas: out, width: out.width / ratio, height: out.height / ratio };
};

// Draws the text on canvas at ratio device pixels per editor pixel; returns its size in editor pixels
export const renderText = (
  text: TextStyleModel,
  ratio: number,
  canvas: HTMLCanvasElement,
): Size => {
  const flat = renderFlat(text, ratio);
  const angle = ((text.curve || 0) / 100) * 2 * Math.PI;
  let result = Math.abs(angle) > 0.001 ? bend(flat, ratio, angle) : flat;
  if (hasTextShadow(text)) result = addShadow(result, text, ratio);
  canvas.width = result.canvas.width;
  canvas.height = result.canvas.height;
  canvas.getContext('2d')!.drawImage(result.canvas, 0, 0);
  // Last, like on an image: the wear also eats the outline and the shadow
  if (text.filter && text.filter !== 'none') filterCanvas(canvas, text.filter);
  return { width: result.width, height: result.height };
};

const painted = new WeakMap<HTMLCanvasElement, string>();

// Shows the text on a canvas of the page, skipped when nothing changed since its last paint.
// sized: the canvas gets the text size in editor px (else CSS sizes it)
export const paintTextCanvas = (
  canvas: HTMLCanvasElement,
  text: TextStyleModel,
  ratio: number,
  sized = true,
) => {
  const key = `${ratio}|${JSON.stringify(text)}`;
  if (painted.get(canvas) === key) return;
  painted.set(canvas, key);
  const size = renderText(text, ratio, canvas);
  if (!sized) return;
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
};

// Paints again on the next paintTextCanvas, e.g. once its font is loaded
export const forgetTextCanvas = (canvas: HTMLCanvasElement) =>
  painted.delete(canvas);
