// Limits of the images users upload, shared by the designer and the admin.
// The server enforces the same size (tshirt-server middleware/uploadMiddleware.js)
export const MAX_UPLOAD_MB = 10;
// Longer images are downscaled: still ~300 DPI on a 35cm print, and light enough for the
// canvas, the captures and the 3D preview (2048px textures) on any device
export const MAX_IMAGE_SIDE = 4096;
// Image files dropped or picked at once: they're prepared one by one, this bounds the wait
export const MAX_FILES_PER_BATCH = 10;
// Beyond this, decoding the image alone can take hundreds of MB and crash mobile tabs
const MAX_DECODE_PIXELS = 100_000_000;
const JPEG_QUALITY = 0.92;
// Profile pictures: a square this size, uploaded as a small webp (or jpeg) file
const AVATAR_SIDE = 256;
const AVATAR_QUALITY = 0.85;

export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];
// For the file inputs' accept attribute
export const ACCEPTED_IMAGE_INPUT = ACCEPTED_IMAGE_TYPES.join(',');

export type ImageRejection = 'type' | 'size' | 'dimensions' | 'unreadable';
export type PreparedImage = { file: File } | { error: ImageRejection };

// Translation of each rejection, with the file { name } and the max { size }
export const IMAGE_REJECTION_KEYS: Record<ImageRejection, string> = {
  type: 'upload.unsupportedType',
  size: 'upload.tooLarge',
  dimensions: 'upload.tooManyPixels',
  unreadable: 'upload.unreadable',
};

// Checks the file and downscales it when its longest side is over MAX_IMAGE_SIDE.
// SVGs are vectors: kept as they are. keepOriginal: only checked, never re-encoded
export async function prepareImage(file: File, keepOriginal = false): Promise<PreparedImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return { error: 'type' };
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return { error: 'size' };
  if (file.type === 'image/svg+xml') return { file };

  const url = URL.createObjectURL(file);
  try {
    // Loading only reads the size: the pixels are decoded when drawn
    const img = await loadImage(url);
    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) return { error: 'unreadable' };
    if (width * height > MAX_DECODE_PIXELS) return { error: 'dimensions' };
    if (keepOriginal || Math.max(width, height) <= MAX_IMAGE_SIDE) return { file };

    const scale = MAX_IMAGE_SIDE / Math.max(width, height);
    const blob = await downscale(
      img,
      Math.round(width * scale),
      Math.round(height * scale),
      file.type,
    );
    if (!blob) return { error: 'unreadable' };
    // Re-encoding can rarely outweigh a very compressed original
    if (blob.size > MAX_UPLOAD_MB * 1024 * 1024) return { error: 'size' };
    return { file: new File([blob], renamed(file.name, blob.type), { type: blob.type }) };
  } catch {
    return { error: 'unreadable' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type PreparedAvatar = { file: Blob } | { error: ImageRejection };

// Center square crop of the image, scaled down to AVATAR_SIDE, as a webp or jpeg
export async function prepareAvatar(file: File): Promise<PreparedAvatar> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return { error: 'type' };
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return { error: 'size' };

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) return { error: 'unreadable' };
    if (width * height > MAX_DECODE_PIXELS) return { error: 'dimensions' };

    const side = Math.min(width, height);
    const size = Math.min(side, AVATAR_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'unreadable' };
    // Transparent pixels would turn black in a jpeg
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);
    // Browsers without webp encoding give png: jpeg is lighter then
    let blob = await canvasBlob(canvas, 'image/webp', AVATAR_QUALITY);
    if (blob?.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', AVATAR_QUALITY);
    canvas.width = canvas.height = 0;
    return blob ? { file: blob } : { error: 'unreadable' };
  } catch {
    return { error: 'unreadable' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The files of a drop or a paste (none for a dragged text or link). Not filtered:
// prepareImage tells which ones are rejected
export const filesOf = (data: DataTransfer | null): File[] =>
  Array.from(data?.files ?? []);

// A file is dragged (not a text, a link or an element of the page)
export const isFileDrag = (event: DragEvent): boolean =>
  !!event.dataTransfer?.types.includes('Files');

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

const canvasBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

function downscale(
  img: HTMLImageElement,
  width: number,
  height: number,
  type: string,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => {
        // Frees the canvas memory right away (Safari keeps it until collected)
        canvas.width = canvas.height = 0;
        resolve(blob);
      },
      // Same type to keep the transparency of png / webp (browsers without webp encoding give png)
      type,
      JPEG_QUALITY,
    ),
  );
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const renamed = (name: string, type: string) =>
  `${name.replace(/\.[^.]+$/, '')}.${EXTENSIONS[type] ?? 'png'}`;
