import { Injectable, signal } from '@angular/core';
import { DesignSide } from '../../models/design-object.model';
import {
  ProductPreview,
  productPreview,
} from '../../components/img-previewer/img-previewer.component';

// Full screen product previewer (zoom, 3D), rendered once in the app root so it covers
// the dialogs and drawers it's opened from (their transforms would trap it otherwise)
@Injectable({ providedIn: 'root' })
export class PreviewService {
  readonly current = signal<(ProductPreview & { side: DesignSide }) | null>(null);

  open(product: { url: string; backUrl?: string | null }, side: DesignSide = 'front') {
    this.current.set({ ...productPreview(product), side });
  }

  close() {
    this.current.set(null);
  }
}
