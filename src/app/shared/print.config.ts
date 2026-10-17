// Printable zone of the products: the designer canvas is printed fitted into it
export const PRINT_AREA_CM = { width: 30, height: 40 };
// Artworks are print-ready when they cover the print area at PRINT_DPI
export const PRINT_DPI = 300;
// Below this, an artwork prints visibly blurry at its placed size
export const MIN_PRINT_DPI = 150;
export const CM_PER_INCH = 2.54;

export const cmToPx = (cm: number, dpi = PRINT_DPI): number =>
  Math.round((cm / CM_PER_INCH) * dpi);
