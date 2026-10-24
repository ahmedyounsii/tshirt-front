import { Injectable, signal } from '@angular/core';
import { DesignSide } from '../../models/design-object.model';
import {
  PreviewView,
  ProductPreview,
} from '../../components/img-previewer/img-previewer.component';
import type { PreviewProduct } from '../../shared/product-preview';

// Shown with a loader while the product's designs are prepared
const LOADING_VIEW: PreviewView = {
  preview: null,
  templateUrl: null,
  designs: [],
  printArea: null,
};

// Full screen product previewer (zoom, 3D), rendered once in the app root so it covers
// the dialogs and drawers it's opened from (their transforms would trap it otherwise)
@Injectable({ providedIn: 'root' })
export class PreviewService {
  readonly current = signal<(ProductPreview & { side: DesignSide }) | null>(null);
  // Only the latest open is shown: a slower one can't replace it, or reopen a closed previewer
  private openRun = 0;

  // The product is drawn from its designer state; captures are only a fallback
  async open(product: PreviewProduct, side: DesignSide = 'front') {
    const run = ++this.openRun;
    this.current.set({ front: LOADING_VIEW, back: null, side });
    // Loaded on first use: the previewer is in the app root, its filters aren't needed on load
    const { productPreviewOf } = await import('../../shared/product-preview');
    const preview = await productPreviewOf(product);
    if (run === this.openRun) this.current.set({ ...preview, side });
  }

  // Ready-made pictures (tees of a collection): shown in 2D as is, with zoom and download
  openImage(url: string, backUrl?: string | null) {
    this.openRun++;
    this.current.set({
      front: { ...LOADING_VIEW, preview: url },
      back: backUrl ? { ...LOADING_VIEW, preview: backUrl } : null,
      side: 'front',
    });
  }

  close() {
    this.openRun++;
    this.current.set(null);
  }
}
