
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  viewChild,
  DOCUMENT,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { PrintArea } from '../product-3d-viewer/compose-product';
// Only used inside @defer, so three.js lands in its own lazy chunk
import { Product3dViewerComponent } from '../product-3d-viewer/product-3d-viewer.component';
import { Product2dViewerComponent } from '../product-2d-viewer/product-2d-viewer.component';
import {
  designObject,
  DesignSide,
} from '../../models/design-object.model';
import { TranslatePipe } from '@ngx-translate/core';
import { downloadImage } from '../../shared/download-canvas';
import { SelectButtonComponent, SelectButtonOption } from '../selectbutton/selectbutton.component';

// Everything needed to preview one side of the product
export type PreviewView = {
  // Ready-made 2D image (products saved without their designer state).
  // Without it, the 2D view is drawn from the template and designs
  preview: string | null;
  templateUrl: string | null;
  designs: designObject[];
  printArea: PrintArea | null;
};

export type ProductPreview = { front: PreviewView; back: PreviewView | null };

@Component({
    selector: 'app-img-previewer',
    imports: [
        SelectButtonComponent,
        TranslatePipe,
        Product2dViewerComponent,
        Product3dViewerComponent,
    ],
    templateUrl: './img-previewer.component.html',
    styleUrl: './img-previewer.component.scss'
})
export class ImgPreviewerComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly overlay = viewChild.required<ElementRef<HTMLDialogElement>>('overlay');
  private previousOverflow: string[] = [];

  @Output() doClosePreviewer = new EventEmitter<any>();
  // Plain image preview
  @Input() preview: any = null;
  // Product preview, 3D composed from the template. With a back, both sides can be previewed
  @Input() front: PreviewView | null = null;
  @Input() back: PreviewView | null = null;
  // Side shown first
  @Input() side: DesignSide = 'front';

  readonly sides: SelectButtonOption<DesignSide>[] = [
    { value: 'front', label: 'common.front' },
    { value: 'back', label: 'common.back' },
  ];

  // Opens in 2D, 3D on demand
  view3d = false;

  // Queried by template ref, not by class: a class token would pull three.js out of the @defer chunk
  readonly viewer3d = viewChild<Product3dViewerComponent>('viewer3d');

  readonly viewer2d = viewChild(Product2dViewerComponent);
  readonly previewImg = viewChild<ElementRef<HTMLImageElement>>('previewImg');
  // Set by the <img> load event (it also refreshes the button): only a loaded image can be converted to PNG
  imageLoaded = false;

  get canDownload(): boolean {
    if (this.show3d) return this.viewer3d()?.loading() === false;
    const viewer2d = this.viewer2d();
    if (viewer2d) return !viewer2d.loading();
    // complete is false again while the other side's image loads
    return this.imageLoaded && !!this.previewImg()?.nativeElement.complete;
  }

  // Whatever is shown is saved: the 3D view as seen, the 2D product or the plain image
  download() {
    if (!this.canDownload) return;
    const fileName = `product-${this.side}-${this.show3d ? '3d' : '2d'}.png`;
    if (this.show3d) return this.viewer3d()?.downloadPng(fileName);
    const viewer2d = this.viewer2d();
    if (viewer2d) return viewer2d.downloadPng(fileName);
    const img = this.previewImg()?.nativeElement;
    if (img) downloadImage(img, fileName);
  }

  private readonly imageView: PreviewView = {
    preview: null,
    templateUrl: null,
    designs: [],
    printArea: null,
  };

  get view(): PreviewView {
    if (this.side === 'back' && this.back) return this.back;
    if (this.front) return this.front;
    // A plain image is its own 3D texture (already composed, no designs to draw)
    this.imageView.preview = this.preview;
    this.imageView.templateUrl = this.preview;
    return this.imageView;
  }

  get show3d(): boolean {
    return !!this.view.templateUrl && this.view3d;
  }

  // Block the page scroll behind the overlay while it's open
  private get scrollRoots(): HTMLElement[] {
    return [this.document.documentElement, this.document.body];
  }

  ngOnInit() {
    this.previousOverflow = this.scrollRoots.map((el) => el.style.overflow);
    this.scrollRoots.forEach((el) => (el.style.overflow = 'hidden'));
  }

  ngAfterViewInit() {
    if (this.isBrowser) this.overlay().nativeElement.showModal();
  }

  // Escape closes the preview, not the dialog it was opened from
  onCancel(event: Event) {
    event.preventDefault();
    this.doClosePreviewer.emit();
  }

  ngOnDestroy() {
    this.scrollRoots.forEach(
      (el, i) => (el.style.overflow = this.previousOverflow[i]),
    );
  }

  zoomLevel = 1; // Default zoom level
  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 0.1, 3); // Limit max zoom
  }

  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel - 0.1, 0.1); // Limit min zoom
  }
}
