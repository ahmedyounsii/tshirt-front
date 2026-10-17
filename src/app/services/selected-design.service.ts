import { inject, Injectable, signal } from '@angular/core';
import {
  designObject,
  SavedDesignObject,
} from '../models/design-object.model';
import { CanvasSize, TshirtModel } from '../models/tshirt.model';
import { tshirtTemplate } from '../shared/templates';
import { environment } from '../../environments/environment';
import { SelectedProductService } from './selected-product.service';

// Saved tshirt loaded in the designer, picked up once by the designer on init
export type EditedTshirt = {
  label: string;
  category?: string;
  // Canvas size at save time: objects are rescaled to the current canvas
  canvas?: CanvasSize;
  // Where that canvas sat on each side's template image
  printAreas?: TshirtModel['printAreas'];
};

@Injectable({
  providedIn: 'root',
})
export class DesignsObjectService {
  private selectedProductService = inject(SelectedProductService);

  designsObjectList = signal<designObject[]>([]);
  designObjectSignal = signal<designObject | null>(null);
  pendingEdit: EditedTshirt | null = null;
  // Saved tshirt the designer is editing: saving offers to update it or create a new one.
  // Unlike pendingEdit it stays set until the user leaves edit mode
  editingTshirt = signal<{ id: string; label: string } | null>(null);

  selectDesignObject(items: designObject[]) {
    this.designsObjectList.set(items);
  }

  // Puts a saved tshirt's template and objects in the designer, in edit mode:
  // saving it afterwards can update the original or create a new tshirt
  async loadTshirt(tshirt: TshirtModel) {
    const template =
      tshirtTemplate.find((t) => t.id === tshirt.templateId) ??
      tshirt.template;
    if (template) this.selectedProductService.selectProduct(template);
    const objects = await Promise.all(
      (tshirt.objects ?? []).map((o, i) => toDesignObject(o, i)),
    );
    this.pendingEdit = {
      label: tshirt.label,
      category: tshirt.category,
      canvas: tshirt.canvas,
      printAreas: tshirt.printAreas,
    };
    this.editingTshirt.set(
      tshirt._id ? { id: tshirt._id, label: tshirt.label } : null,
    );
    this.designsObjectList.set(objects);
  }

  // The design stays on the canvas, but saving it creates a new tshirt
  stopEditing() {
    this.editingTshirt.set(null);
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
  return {
    ...base,
    url,
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
