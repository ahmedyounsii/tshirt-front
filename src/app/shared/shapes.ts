import type { ShapeStyleModel } from '../models/design-object.model';

export type ShapeKind =
  | 'circle'
  | 'square'
  | 'roundedSquare'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'star'
  | 'heart'
  | 'ring'
  | 'cross'
  | 'arrow'
  | 'bubble';

// A shape drawn in a width x height box (its ratio is kept when resized)
export type ShapeDef = {
  kind: ShapeKind;
  width: number;
  height: number;
  path: string;
};

export const SHAPES: ShapeDef[] = [
  { kind: 'circle', width: 100, height: 100, path: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z' },
  { kind: 'square', width: 100, height: 100, path: 'M0 0H100V100H0Z' },
  {
    kind: 'roundedSquare',
    width: 100,
    height: 100,
    path: 'M20 0H80A20 20 0 0 1 100 20V80A20 20 0 0 1 80 100H20A20 20 0 0 1 0 80V20A20 20 0 0 1 20 0Z',
  },
  { kind: 'triangle', width: 100, height: 87, path: 'M50 0L100 87H0Z' },
  { kind: 'diamond', width: 100, height: 100, path: 'M50 0L100 50L50 100L0 50Z' },
  { kind: 'hexagon', width: 100, height: 87, path: 'M25 0H75L100 43.5L75 87H25L0 43.5Z' },
  {
    kind: 'star',
    width: 95.1,
    height: 90.45,
    path: 'M47.55 0L58.78 34.55H95.1L65.71 55.9L76.94 90.45L47.55 69.1L18.16 90.45L29.39 55.9L0 34.55H36.32Z',
  },
  {
    kind: 'heart',
    width: 100,
    height: 90,
    path: 'M50 90C20 66 0 48 0 26C0 11 12 0 27 0C37 0 45 5 50 13C55 5 63 0 73 0C88 0 100 11 100 26C100 48 80 66 50 90Z',
  },
  {
    kind: 'ring',
    width: 100,
    height: 100,
    path: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0ZM50 25A25 25 0 1 0 50 75A25 25 0 1 0 50 25Z',
  },
  { kind: 'cross', width: 100, height: 100, path: 'M35 0H65V35H100V65H65V100H35V65H0V35H35Z' },
  { kind: 'arrow', width: 100, height: 60, path: 'M0 20H60V0L100 30L60 60V40H0Z' },
  {
    kind: 'bubble',
    width: 100,
    height: 90,
    path: 'M15 0H85A15 15 0 0 1 100 15V55A15 15 0 0 1 85 70H45L25 90V70H15A15 15 0 0 1 0 55V15A15 15 0 0 1 15 0Z',
  },
];

// Outline width, in units of the shape box (about px at the size it's added)
export const SHAPE_STROKE_LIMITS = { min: 0, max: 20 };
// Outline width given when an outline color is picked without one
export const DEFAULT_SHAPE_STROKE = 4;
// Fill that leaves only the outline
export const SHAPE_TRANSPARENT = 'transparent';

// The image is this many px per unit of the box: never smaller than its box on the
// canvas (images aren't upscaled), so it stays sharp at any size
const SHAPE_IMAGE_SCALE = 10;

export const shapeDef = (kind: ShapeKind): ShapeDef =>
  SHAPES.find((s) => s.kind === kind) ?? SHAPES[0];

export const defaultShapeStyle = (kind: ShapeKind): ShapeStyleModel => ({
  kind,
  fill: '#000000',
  strokeWidth: 0,
  strokeColor: '#000000',
});

// The shape as an svg image: shown and captured like any placed image.
// The outline is drawn inside the shape (clipped, twice as wide), so the box and its
// ratio don't change with the outline width
export const shapeUrl = (style: ShapeStyleModel): string => {
  const { width, height, path } = shapeDef(style.kind);
  const fill = style.fill === SHAPE_TRANSPARENT ? 'none' : style.fill;
  const strokeWidth = style.strokeWidth ?? 0;
  const outline =
    strokeWidth > 0
      ? `<path d="${path}" fill="none" stroke="${style.strokeColor ?? '#000000'}" stroke-width="${strokeWidth * 2}" stroke-linejoin="round" clip-path="url(#c)"/>`
      : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width * SHAPE_IMAGE_SCALE}" height="${height * SHAPE_IMAGE_SCALE}" fill-rule="evenodd">` +
    `<defs><clipPath id="c"><path d="${path}" clip-rule="evenodd"/></clipPath></defs>` +
    `<path d="${path}" fill="${fill}"/>${outline}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
