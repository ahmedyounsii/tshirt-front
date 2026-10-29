import { inject, Injectable, signal } from '@angular/core';
import {
  designObject,
  SavedDesignObject,
} from '../models/design-object.model';
import { CanvasSize, ProductModel } from '../models/product.model';
import { environment } from '../../environments/environment';
import { SelectedProductService } from './selected-product.service';
import { TemplatesService } from './templates/templates.service';
import { DesignModel } from '../models/design.model';
import {
  applyDesignFilter,
  hasFilter,
  releaseDesignFilters,
} from '../shared/design-filters';

// Saved product loaded in the designer, picked up once by the designer on init
export type EditedProduct = {
  label: string;
  category?: string;
  tags?: string[];
  // Admin's price override, prefilled in the save dialog
  customPrice?: number | null;
  // Canvas size at save time: objects are rescaled to the current canvas
  canvas?: CanvasSize;
  // Where that canvas sat on each side's template image
  printAreas?: ProductModel['printAreas'];
};

@Injectable({
  providedIn: 'root',
})
export class DesignsObjectService {
  private selectedProductService = inject(SelectedProductService);
  private templatesService = inject(TemplatesService);

  designsObjectList = signal<designObject[]>([]);
  designObjectSignal = signal<designObject | null>(null);
  pendingEdit: EditedProduct | null = null;
  // Saved product the designer is editing: saving offers to update it or create a new one.
  // Unlike pendingEdit it stays set until the user leaves edit mode
  editingProduct = signal<{ id: string; label: string } | null>(null);
  // Design picked outside the designer (designs gallery), added to the canvas once by the designer on init
  pendingDesign: DesignModel | null = null;

  setDesignsObjects(items: designObject[]) {
    this.designsObjectList.set(items);
  }

  // Puts a saved product's template and objects in the designer, in edit mode:
  // saving it afterwards can update the original or create a new product
  async loadProduct(product: ProductModel) {
    const template =
      this.templatesService.byId(product.templateId) ?? product.template;
    if (template) this.selectedProductService.selectProduct(template);
    const objects = await Promise.all(
      (product.objects ?? []).map((o, i) => toDesignObject(o, i)),
    );
    this.pendingEdit = {
      label: product.label,
      category: product.category,
      tags: product.tags,
      customPrice: product.customPrice,
      canvas: product.canvas,
      printAreas: product.printAreas,
    };
    this.editingProduct.set(
      product._id ? { id: product._id, label: product.label } : null,
    );
    this.designsObjectList.set(objects);
  }

  // Returns the pending design (once) with a base64 copy of its image, like picking it in the designer
  async takePendingDesign(): Promise<DesignModel | null> {
    const design = this.pendingDesign;
    if (!design) return null;
    this.pendingDesign = null;
    const url = await toPngDataUrl(design.url).catch(() => design.url);
    return { ...design, url, storedUrl: design.storedUrl ?? design.url };
  }

  // The design stays on the canvas, but saving it creates a new product
  stopEditing() {
    this.editingProduct.set(null);
  }

  // Leaving the designer: the next visit starts from an empty default product
  reset() {
    this.designsObjectList.set([]);
    this.designObjectSignal.set(null);
    this.editingProduct.set(null);
    this.pendingEdit = null;
    this.selectedProductService.selectProduct(null);
    releaseDesignFilters();
  }
}

const toDesignObject = async (
  saved: SavedDesignObject,
  index: number,
): Promise<designObject> => {
  const base = {
    id: `edit_${Date.now()}_${index}`,
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
  if (saved.type === 'text') {
    return { ...base, url: null, text: saved.text && { ...saved.text } };
  }
  const remoteUrl = saved.designUrl
    ? `${environment.baseUrl}${saved.designUrl}`
    : '';
  // Same as picking a design: a base64 copy keeps the captures working
  const url = remoteUrl ? await toPngDataUrl(remoteUrl).catch(() => remoteUrl) : '';
  const filter = hasFilter(saved.filter) ? { type: saved.filter.type } : undefined;
  // Shown filtered, as it was saved; the design keeps the original
  const shownUrl =
    url && filter
      ? await applyDesignFilter(url, filter).catch(() => url)
      : url;
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

const toPngDataUrl = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 500;
      canvas.height = img.naturalHeight || 500;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
