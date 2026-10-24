import { environment } from '../../environments/environment';
import {
  designObject,
  DesignSide,
  SavedDesignObject,
} from '../models/design-object.model';
import { ProductModel } from '../models/product.model';
import type {
  PreviewView,
  ProductPreview,
} from '../components/img-previewer/img-previewer.component';
import { applyDesignFilter, hasFilter } from './design-filters';
import { templateImageUrl } from '../services/templates/templates.service';
import { loadTextFonts } from './text-fonts';

// What the previewer needs of a product: its captures (absolute urls),
// and the designer state they were made from
export type PreviewProduct = Pick<
  ProductModel,
  'templateId' | 'template' | 'canvas' | 'printAreas' | 'objects'
> & {
  url: string;
  backUrl?: string | null;
};

// Each side is drawn from the template, the designs and the print area, like in the designer.
// A side saved without that state (older products) shows its capture instead
export const productPreviewOf = async (
  product: PreviewProduct,
): Promise<ProductPreview> => {
  if (product.objects?.some((o) => o.type === 'text')) {
    await loadTextFonts(document);
  }
  const [front, back] = await Promise.all([
    sideView(product, 'front', product.url),
    product.backUrl ? sideView(product, 'back', product.backUrl) : null,
  ]);
  return { front, back };
};

// A capture is already composed (template + designs): it is its own 3D texture
export const captureView = (url: string): PreviewView => ({
  preview: url,
  templateUrl: url,
  designs: [],
  printArea: null,
});

const sideView = async (
  product: PreviewProduct,
  side: DesignSide,
  capture: string,
): Promise<PreviewView> => {
  // The copy saved with the product: the print areas were measured on its images
  const template = product.template;
  const templateImg = side === 'back' ? template?.backImg : template?.frontImg;
  const area = product.printAreas?.[side];
  const canvas = product.canvas;
  if (!templateImg || !area?.width || !area.height || !canvas?.width) {
    return captureView(capture);
  }
  const designs = await Promise.all(
    (product.objects ?? [])
      .filter((o) => (o.side ?? 'front') === side)
      .map((o, i) => toDesignObject(o, i)),
  );
  return {
    preview: null,
    templateUrl: templateImageUrl(templateImg),
    designs,
    printArea: {
      left: area.left,
      top: area.top,
      width: area.width,
      height: area.height,
      // Width of the template image in editor pixels, at save time
      imageDomWidth: canvas.width / area.width,
    },
  };
};

const toDesignObject = async (
  saved: SavedDesignObject,
  index: number,
): Promise<designObject> => {
  const base = {
    id: `preview_${index}`,
    type: saved.type,
    side: saved.side,
    width: saved.width,
    height: saved.height,
    left: saved.left,
    top: saved.top,
    rotation: saved.rotation,
    flipX: saved.flipX,
    flipY: saved.flipY,
  };
  if (saved.type === 'text') return { ...base, url: null, text: saved.text };
  const url = saved.designUrl ? `${environment.baseUrl}${saved.designUrl}` : '';
  // The stored design is the original: its effect is applied as in the designer
  const filter = hasFilter(saved.filter) ? { type: saved.filter.type } : undefined;
  const shownUrl =
    url && filter ? await applyDesignFilter(url, filter).catch(() => url) : url;
  return {
    ...base,
    url: shownUrl,
    filter: shownUrl === url ? undefined : filter,
    design: {
      _id: saved.design,
      url,
      label: saved.designLabel,
      storedUrl: saved.designUrl,
    },
  };
};
