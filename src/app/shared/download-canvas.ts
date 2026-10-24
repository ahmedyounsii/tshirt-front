// Saves a canvas as a PNG file, cropped to the product. The canvas must not be tainted (cross-origin images loaded with CORS)
export const downloadCanvas = (canvas: HTMLCanvasElement, fileName: string) => {
  const link = document.createElement('a');
  link.href = trimTransparent(canvas).toDataURL('image/png');
  link.download = fileName;
  link.click();
};

// Saves a loaded image as a PNG, whatever its original format (webp, jpg...)
export const downloadImage = (img: HTMLImageElement, fileName: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  downloadCanvas(canvas, fileName);
};

// Crop the fully transparent margins around the product
export const trimTransparent = (source: HTMLCanvasElement): HTMLCanvasElement => {
  // A WebGL canvas has no 2D context: its pixels are read through a 2D copy
  const canvas = source.getContext('2d') ? source : copyTo2d(source);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const isEmpty = (x: number, y: number) => data[(y * width + x) * 4 + 3] === 0;
  const rowEmpty = (y: number) => {
    for (let x = 0; x < width; x++) if (!isEmpty(x, y)) return false;
    return true;
  };
  const columnEmpty = (x: number) => {
    for (let y = top; y <= bottom; y++) if (!isEmpty(x, y)) return false;
    return true;
  };

  // Scan inwards from each edge and stop at the first drawn pixel,
  // instead of visiting every pixel of the capture
  let top = 0;
  while (top < height && rowEmpty(top)) top++;
  if (top === height) return canvas; // Nothing drawn
  let bottom = height - 1;
  while (bottom > top && rowEmpty(bottom)) bottom--;
  let left = 0;
  while (left < width - 1 && columnEmpty(left)) left++;
  let right = width - 1;
  while (right > left && columnEmpty(right)) right--;

  const trimmed = document.createElement('canvas');
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed
    .getContext('2d')!
    .drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
};

const copyTo2d = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext('2d')!.drawImage(source, 0, 0);
  return copy;
};
