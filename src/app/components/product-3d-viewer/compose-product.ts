import { environment } from '../../../environments/environment';
import {
  designObject,
  TextStyleModel,
} from '../../models/design-object.model';
import { hasFilter } from '../../shared/design-filters';

// Print zone of the 2D editor, normalized to the template image (0..1),
// plus the on-screen width of the image so editor pixels can be mapped to canvas pixels
export type PrintArea = {
  left: number;
  top: number;
  width: number;
  height: number;
  imageDomWidth: number;
};

// Original file of an image object: the stored design, or the local upload.
// The designer shows a base64 PNG copy of it (made for the DOM captures), which is lower quality for SVGs.
// A filtered image is drawn as shown: the original doesn't have the effect
const referenceUrlOf = (design: designObject): string | null => {
  if (hasFilter(design.filter)) return null;
  const ref = design.design;
  if (ref?.storedUrl) return `${environment.baseUrl}${ref.storedUrl}`;
  if (ref?.url && !ref.url.startsWith('data:')) return ref.url;
  return null;
};

// CSS font of a text, at the size it's drawn
const fontOf = (text: TextStyleModel, fontSize: number): string =>
  `${text.italic ? 'italic ' : ''}${text.bold ? 700 : 400} ${fontSize}px ${text.fontFamily}`;

export type ComposeInput = {
  templateUrl: string;
  designs: designObject[];
  printArea: PrintArea | null;
};

// Draws the template and its designs on a canvas, the same way they're placed in the editor.
// Shared by the 2D preview (shown as is) and the 3D preview (used as a texture)
export class ProductComposer {
  private imageCache = new Map<string, Promise<HTMLImageElement>>();

  // Resolves with the template image, or null when a newer compose made this one stale
  async compose(
    canvas: HTMLCanvasElement,
    { templateUrl, designs, printArea }: ComposeInput,
    maxSize: number,
    isStale: () => boolean,
  ): Promise<HTMLImageElement | null> {
    const base = await this.loadImage(templateUrl);
    await document.fonts?.ready;
    if (isStale()) return null;

    // The template is upscaled so designs and texts are drawn sharp
    const scale = maxSize / Math.max(base.naturalWidth, base.naturalHeight);
    const width = Math.round(base.naturalWidth * scale);
    const height = Math.round(base.naturalHeight * scale);

    // Drawn offscreen first, so a visible canvas never shows a half-drawn product
    const work = document.createElement('canvas');
    work.width = width;
    work.height = height;
    const ctx = work.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(base, 0, 0, width, height);

    if (printArea) {
      // Designs only show where the shirt is (not on the transparent background)
      ctx.globalCompositeOperation = 'source-atop';
      for (const design of designs) {
        if (isStale()) return null;
        await this.drawDesign(ctx, design, printArea, width, height);
      }
    }
    if (isStale()) return null;

    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(work, 0, 0);
    return base;
  }

  private async drawDesign(
    ctx: CanvasRenderingContext2D,
    design: designObject,
    area: PrintArea,
    texWidth: number,
    texHeight: number,
  ) {
    // Editor pixel -> canvas pixel
    const s = texWidth / area.imageDomWidth;
    const originX = area.left * texWidth + design.left * s;
    const originY = area.top * texHeight + design.top * s;

    if (design.type === 'text' && design.text) {
      // A font only used on a canvas isn't downloaded by itself (e.g. a gallery preview)
      try {
        await document.fonts?.load(fontOf(design.text, design.text.fontSize * s));
      } catch {}
      this.drawText(ctx, design, originX, originY, s);
      return;
    }
    if (!design.url) return;
    // The designer image sets the size, exactly as laid out in the editor;
    // the reference is what gets drawn
    let layout: HTMLImageElement;
    try {
      layout = await this.loadImage(design.url);
    } catch {
      return;
    }
    const refUrl = referenceUrlOf(design);
    const img = refUrl
      ? await this.loadImage(refUrl).catch(() => layout)
      : layout;
    // Same as max-width/max-height: 100% + object-fit: contain inside the design box
    const fit = Math.min(
      1,
      design.width / layout.naturalWidth,
      design.height / layout.naturalHeight,
    );
    const w = layout.naturalWidth * fit * s;
    const h = layout.naturalHeight * fit * s;
    const boxW = design.width * s;
    const boxH = design.height * s;
    this.withTransform(
      ctx,
      design,
      originX + boxW / 2,
      originY + boxH / 2,
      () => ctx.drawImage(img, -w / 2, -h / 2, w, h),
    );
  }

  private drawText(
    ctx: CanvasRenderingContext2D,
    design: designObject,
    originX: number,
    originY: number,
    s: number,
  ) {
    const text = design.text!;
    const fontSize = text.fontSize * s;
    const lineHeight = fontSize * 1.2;
    const lines = text.content.split('\n');

    ctx.save();
    ctx.font = fontOf(text, fontSize);
    if ('letterSpacing' in ctx) {
      (ctx as any).letterSpacing = `${text.letterSpacing * s}px`;
    }
    const lineWidths = lines.map((line: any) => ctx.measureText(line).width);
    const blockW = Math.max(...lineWidths, 0);
    const blockH = lines.length * lineHeight;
    // The editor box has a 2px 4px padding around the text
    const centerX = originX + 4 * s + blockW / 2;
    const centerY = originY + 2 * s + blockH / 2;

    this.withTransform(ctx, design, centerX, centerY, () => {
      ctx.fillStyle = text.color;
      ctx.strokeStyle = text.color;
      ctx.textBaseline = 'middle';
      lines.forEach((line: any, i: any) => {
        const lineW = lineWidths[i];
        let x = -blockW / 2;
        if (text.align === 'center') x += (blockW - lineW) / 2;
        if (text.align === 'right') x += blockW - lineW;
        const y = -blockH / 2 + lineHeight * (i + 0.5);
        ctx.fillText(line, x, y);
        if (text.underline) {
          ctx.lineWidth = Math.max(1, fontSize / 15);
          ctx.beginPath();
          ctx.moveTo(x, y + fontSize * 0.45);
          ctx.lineTo(x + lineW, y + fontSize * 0.45);
          ctx.stroke();
        }
      });
    });
    ctx.restore();
  }

  // Rotation and flips are applied around the center, like the CSS transform in the editor
  private withTransform(
    ctx: CanvasRenderingContext2D,
    design: designObject,
    centerX: number,
    centerY: number,
    draw: () => void,
  ) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(((design.rotation || 0) * Math.PI) / 180);
    ctx.scale(design.flipX ? -1 : 1, design.flipY ? -1 : 1);
    draw();
    ctx.restore();
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    let promise = this.imageCache.get(url);
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      promise.catch(() => this.imageCache.delete(url));
      this.imageCache.set(url, promise);
    }
    return promise;
  }
}
