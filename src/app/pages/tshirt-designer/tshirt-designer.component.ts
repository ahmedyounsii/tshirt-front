import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import {
  downloadImageLogic,
  dragReize,
} from './logic/designer-logic';
import { FormsModule } from '@angular/forms';
import { ConfigCategoriesComponent } from './components/config-categories/config-categories.component';
import { DesignEditionComponent } from './components/design-edition/design-edition.component';
import {
  designObject,
  DesignSide,
  SavedDesignObject,
  TextStyleModel,
} from '../../models/design-object.model';
import { SelectedProductService } from '../../services/selected-product.service';
import { TemplateModel } from '../../models/template.model';
import { DesignerConfigComponent } from './components/designer-config/designer-config.component';
import { DesignsObjectService } from '../../services/selected-design.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TshirtsService } from '../../services/tshirts/tshirts.service';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { DesignsService } from '../../services/designs/design.service';
import { DesignModel } from '../../models/design.model';
import { firstValueFrom } from 'rxjs';
import {
  CanvasSize,
  SavedPrintArea,
  TshirtPayload,
} from '../../models/tshirt.model';
import { tshirtTemplate } from '../../shared/templates';
import { loadTextFonts } from '../../shared/text-fonts';
import {
  BottomDrawerComponent,
  isMobile,
} from './components/bottom-drawer/bottom-drawer.component';
import { TextEditionComponent } from './components/text-edition/text-edition.component';
import {
  ImgPreviewerComponent,
  PreviewView,
} from '../../components/img-previewer/img-previewer.component';
import type { PrintArea } from '../../components/tshirt-3d-viewer/tshirt-3d-viewer.component';
import { LayersPanelComponent } from './components/layers-panel/layers-panel.component';
import { AuthService } from '../../services/auth/auth.service';
import { ConfirmService } from '../../services/confirm/confirm.service';

@Component({
  selector: 'app-tshirt-designer',
  standalone: true,
  imports: [
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    DesignerConfigComponent,
    NgClass,
    FormsModule,
    ConfigCategoriesComponent,
    DesignEditionComponent,
    ImgPreviewerComponent,
    BottomDrawerComponent,
    TextEditionComponent,
    LayersPanelComponent,
  ],
  templateUrl: './tshirt-designer.component.html',
  styleUrl: './tshirt-designer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TshirtDesignerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef;
  @ViewChild('configRef') configRef!: ElementRef;
  @ViewChild('containerRef') containerRef!: ElementRef<HTMLElement>;

  private cdr = inject(ChangeDetectorRef);

  private selectedProductService = inject(SelectedProductService);
  private designsObjectService = inject(DesignsObjectService);
  private tshirtsService = inject(TshirtsService);
  private confirm = inject(ConfirmService);
  private categoriesService = inject(CategoriesService);
  private designsService = inject(DesignsService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // Local blob url -> design stored in the backend
  private savedUploads = new Map<string, DesignModel>();

  selectedConfigCategory: any = null;
  selectedDesign: any = null;
  selectedProduct: TemplateModel | null = null;
  desableUnselect = false;
  previewOpen = false;
  // One view per side of the template, filled when the preview opens
  previewViews: Partial<Record<DesignSide, PreviewView>> = {};
  previewSide: DesignSide = 'front';
  // Bumped on each preview, so a closed preview stops its captures
  private previewRun = 0;
  designsObject: designObject[] = [];
  // Side being designed: the canvas only shows (and edits) the objects of this side
  side: DesignSide = 'front';
  // Objects of the current side, kept as a stable array for the canvas and the 3D preview
  sideDesigns: designObject[] = [];
  // Number of objects per side, shown on the side switch (kept up to date by updateSideDesigns)
  private sideCounts: Record<DesignSide, number> = { front: 0, back: 0 };
  readonly sides: { side: DesignSide; label: string }[] = [
    { side: 'front', label: 'Front' },
    { side: 'back', label: 'Back' },
  ];
  // Mobile: tapping a text opens its editor in a bottom drawer
  textDrawerOpen = false;
  private pointerDownPos: { x: number; y: number } | null = null;
  private static readonly TAP_MAX_DISTANCE = 5;

  saveDialogVisible = false;
  loginDialogVisible = false;
  saving = false;
  tshirtLabel = '';
  tshirtCategoryId = '';
  saveError: string | null = null;
  categories: DesignCategoryModel[] = [];
  // Saving needs an account: anonymous users are sent to the login page first
  readonly isLoggedIn = this.auth.isLoggedIn;
  // Set when a saved tshirt was opened from "My designs"
  readonly editingTshirt = this.designsObjectService.editingTshirt;

  get canSave(): boolean {
    return !!this.tshirtLabel.trim() && !!this.tshirtCategoryId && !this.saving;
  }

  get hasBack(): boolean {
    return !!this.selectedProduct?.backImg;
  }

  get templateImg(): string | undefined {
    return this.side === 'back' && this.selectedProduct?.backImg
      ? this.selectedProduct.backImg
      : this.selectedProduct?.frontImg;
  }

  // Back designs placed before switching to a template without a back can't be saved
  get hasUnsavableBackDesigns(): boolean {
    return !this.hasBack && this.sideCounts.back > 0;
  }

  // Precomputed: called by the template on every check
  countSide(side: DesignSide): number {
    return this.sideCounts[side];
  }

  constructor() {
    if (this.isBrowser) loadTextFonts(inject(DOCUMENT));
    effect(() => {
      this.selectedProduct = this.selectedProductService.product();
      this.designsObject = this.designsObjectService.designsObjectList();
      // The new template may have no back
      if (!this.hasBack) this.side = 'front';
      this.updateSideDesigns();
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    this.applyPendingEdit();
    if (!this.selectedDesign) return;
    dragReize(this.selectedDesign);
    this.cdr.detectChanges();
  }

  // A saved tshirt was opened for edition: its objects were placed on a canvas
  // of another size, and its label/category prefill the save dialog
  private async applyPendingEdit() {
    const edit = this.designsObjectService.pendingEdit;
    if (!edit) return;
    this.designsObjectService.pendingEdit = null;
    this.tshirtLabel = edit.label;
    this.tshirtCategoryId = edit.category ?? '';
    if (!edit.canvas?.width || !edit.canvas.height) return;
    // The effect may not have run yet: read the loaded tshirt from the services
    this.selectedProduct = this.selectedProductService.product();
    this.designsObject = this.designsObjectService.designsObjectList();
    this.updateSideDesigns();
    this.cdr.detectChanges();

    const startSide = this.side;
    const sides: DesignSide[] = this.hasBack ? ['front', 'back'] : ['front'];
    try {
      for (const side of sides) {
        const objects = this.designsObject.filter((d) => sideOf(d) === side);
        if (objects.length === 0) continue;
        this.switchSide(side);
        // The canvas is sized from the template image: measure it once loaded
        await this.waitForTemplateImage();
        const fit = this.fitToCurrentCanvas(edit.canvas, edit.printAreas?.[side]);
        if (fit) for (const d of objects) fit(d);
      }
    } finally {
      this.switchSide(startSide);
      this.cdr.detectChanges();
    }
  }

  // Maps objects placed on the saved canvas onto the current one, keeping their
  // place on the tshirt image (the canvas isn't the same share of the image on every screen)
  private fitToCurrentCanvas(
    saved: CanvasSize,
    savedArea?: SavedPrintArea,
  ): ((d: designObject) => void) | null {
    const canvas: HTMLElement | undefined = this.canvasRef?.nativeElement;
    const area = this.measurePrintArea();
    if (!canvas?.clientWidth || !canvas.clientHeight || !area) return null;

    let scale = canvas.clientWidth / saved.width;
    let offsetX = 0;
    let offsetY = 0;
    if (savedArea?.width && savedArea.height) {
      const savedImgWidth = saved.width / savedArea.width;
      const imgWidth = canvas.clientWidth / area.width;
      const imgHeight = canvas.clientHeight / area.height;
      scale = imgWidth / savedImgWidth;
      offsetX = (savedArea.left - area.left) * imgWidth;
      offsetY = (savedArea.top - area.top) * imgHeight;
    }
    if (
      Math.abs(scale - 1) < 0.001 &&
      Math.abs(offsetX) < 0.5 &&
      Math.abs(offsetY) < 0.5
    )
      return null;

    return (d) => {
      d.left = d.left * scale + offsetX;
      d.top = d.top * scale + offsetY;
      d.width *= scale;
      d.height *= scale;
      if (d.text) {
        d.text.fontSize = Math.round(d.text.fontSize * scale * 10) / 10;
        d.text.letterSpacing *= scale;
      }
    };
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.canvasRef && this.configRef) {
      // composedPath keeps the original path even if the target was removed from the DOM during the click
      const path = event.composedPath();
      // PrimeNG overlays (select dropdown...) are appended to the body, so count them as inside
      const clickedInOverlay = path.some(
        (el) =>
          el instanceof HTMLElement &&
          (el.classList.contains('p-overlay') ||
            el.classList.contains('p-select-overlay')),
      );
      const clickedInside =
        clickedInOverlay ||
        path.includes(this.canvasRef.nativeElement) ||
        path.includes(this.configRef.nativeElement);

      if (!clickedInside && this.selectedDesign) {
        this.unSelectDesignObject();
      }
      this.desableUnselect = false;
    }
  }

  switchSide(side: DesignSide) {
    if (side === this.side || (side === 'back' && !this.hasBack)) return;
    this.selectedDesign = null;
    this.textDrawerOpen = false;
    this.side = side;
    this.updateSideDesigns();
    this.cdr.detectChanges();
  }

  private updateSideDesigns() {
    this.sideDesigns = this.designsObject.filter(
      (d) => sideOf(d) === this.side,
    );
    this.sideCounts = { front: 0, back: 0 };
    for (const d of this.designsObject) this.sideCounts[sideOf(d)]++;
  }

  selectConfigCategory(item: any) {
    this.selectedConfigCategory = item;
  }

  selectDesignObject(designObject: designObject) {
    this.desableUnselect = true;
    // Already selected (mousedown then click): drag/resize is already set up
    if (this.selectedDesign === designObject) return;
    this.selectedDesign = designObject;
    this.ngAfterViewInit();
    this.cdr.detectChanges();
  }

  onDesignPointerDown(event: PointerEvent) {
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
  }

  // Open the text drawer only on a tap, not at the end of a drag
  onDesignTap(design: designObject, event: MouseEvent) {
    if (design.type !== 'text' || !isMobile() || !this.pointerDownPos) return;
    const moved = Math.hypot(
      event.clientX - this.pointerDownPos.x,
      event.clientY - this.pointerDownPos.y,
    );
    this.pointerDownPos = null;
    if (moved > TshirtDesignerComponent.TAP_MAX_DISTANCE) return;
    this.textDrawerOpen = true;
    this.cdr.detectChanges();
  }

  addDesign(designObject: designObject) {
    const newDesignObject: designObject = {
      id: uniqueId('design_'),
      type: 'image',
      side: this.side,
      url: designObject.url,
      width: 100,
      height: 100,
      left: 0,
      top: 0,
      rotation: 0,
      flipX: false,
      flipY: false,
      design: designObject,
    };
    this.designsObject.push(newDesignObject);
    this.updateSideDesigns();
    this.selectDesignObject(newDesignObject);
  }

  // Shrink the box to the image ratio (keeping its longest side) so the frame hugs the image
  fitDesignToImage(design: designObject, event: Event) {
    const img = event.target as HTMLImageElement;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const size = Math.max(design.width, design.height);
    const width = ratio >= 1 ? size : size * ratio;
    const height = ratio >= 1 ? size / ratio : size;
    // Already fitted
    if (
      Math.abs(width - design.width) < 1 &&
      Math.abs(height - design.height) < 1
    )
      return;
    design.width = width;
    design.height = height;
    this.cdr.detectChanges();
  }

  addText(textStyle: TextStyleModel) {
    // Stack new texts vertically so they don't land on top of each other
    const textCount = this.sideDesigns.filter(
      (d) => d.type === 'text',
    ).length;
    const canvasHeight = this.canvasRef?.nativeElement.clientHeight ?? 0;
    const step = 40;
    const maxTop = Math.max(canvasHeight - step, step);

    const newTextObject: designObject = {
      id: uniqueId('text_'),
      type: 'text',
      side: this.side,
      url: null,
      width: 0,
      height: 0,
      left: 0,
      top: (textCount * step) % maxTop,
      rotation: 0,
      flipX: false,
      flipY: false,
      text: textStyle,
    };
    this.designsObject.push(newTextObject);
    this.updateSideDesigns();
    // Close the text config and select the new text so it can be edited right away
    this.selectedConfigCategory = null;
    this.selectDesignObject(newTextObject);
  }

  // New back to front order of the current side's objects; the other side keeps its order
  reorderLayers(order: designObject[]) {
    this.designsObject = [
      ...this.designsObject.filter((d) => sideOf(d) !== this.side),
      ...order,
    ];
    this.updateSideDesigns();
    this.designsObjectService.selectDesignObject(this.designsObject);
    this.cdr.detectChanges();
  }

  async deleteDesignObject(designObject: designObject, event?: any) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const ok = await this.confirm.confirmDelete(
      'Remove this item from your design?',
      'Remove item',
    );
    if (!ok) return;
    this.designsObject = this.designsObject.filter(
      (item) => item.id !== designObject.id,
    );
    this.updateSideDesigns();
    // Keep the current config category open so the user stays where they were
    this.unSelectDesignObject(true);
  }

  unSelectDesignObject(keepCategory = false) {
    this.selectedDesign = null;
    this.textDrawerOpen = false;
    if (!keepCategory) this.selectedConfigCategory = null;
    this.designsObjectService.selectDesignObject(this.designsObject);
    this.cdr.detectChanges();
  }

  // Position of the print zone relative to the template image, so the 3D view
  // can draw the designs at the same place on the texture
  private measurePrintArea(): PrintArea | null {
    const img = this.containerRef?.nativeElement.querySelector('.tshirt-base');
    const canvas: HTMLElement | undefined = this.canvasRef?.nativeElement;
    if (!img || !canvas) return null;
    const imgRect = img.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    if (!imgRect.width || !imgRect.height) return null;
    return {
      left:
        (canvasRect.left + canvas.clientLeft - imgRect.left) / imgRect.width,
      top: (canvasRect.top + canvas.clientTop - imgRect.top) / imgRect.height,
      width: canvas.clientWidth / imgRect.width,
      height: canvas.clientHeight / imgRect.height,
      imageDomWidth: imgRect.width,
    };
  }

  // Previews every side of the template, always opening on the front
  async export() {
    this.unSelectDesignObject();
    const run = ++this.previewRun;
    const startSide = this.side;
    const sides: DesignSide[] = this.hasBack ? ['front', 'back'] : ['front'];
    const isCurrentRun = () => this.previewOpen && run === this.previewRun;

    this.previewViews = {};
    this.previewSide = 'front';
    this.previewOpen = true;
    this.cdr.detectChanges();
    try {
      // 3D views first: they only need the print area, the 2D captures are slower
      for (const side of sides) {
        this.switchSide(side);
        await this.waitForTemplateImage();
        if (!isCurrentRun()) return;
        this.setPreviewView(side, {
          preview: null,
          templateUrl: `./assets/templates/${this.templateImg}`,
          designs: this.sideDesigns,
          // Used by the 3D preview to place the designs on the template
          printArea: this.measurePrintArea(),
        });
      }
      for (const side of sides) {
        this.switchSide(side);
        await this.waitForTemplateImage();
        const preview = await downloadImageLogic('.designer-container');
        if (!isCurrentRun()) return;
        if (!preview) {
          console.error(`Failed to generate the ${side} preview.`);
          continue;
        }
        this.setPreviewView(side, { ...this.previewViews[side]!, preview });
      }
    } finally {
      if (run === this.previewRun) this.switchSide(startSide);
    }
  }

  closePreview() {
    this.previewOpen = false;
    this.previewViews = {};
    this.cdr.detectChanges();
  }

  private setPreviewView(side: DesignSide, view: PreviewView) {
    this.previewViews = { ...this.previewViews, [side]: view };
    this.cdr.detectChanges();
  }

  goToLogin() {
    this.loginDialogVisible = false;
    // The canvas is kept in root services, so the design is still here on return
    this.router.navigate(['/auth'], {
      queryParams: { returnUrl: '/designer' },
    });
  }

  openSaveDialog() {
    if (!this.isLoggedIn()) {
      this.loginDialogVisible = true;
      this.cdr.detectChanges();
      return;
    }
    this.unSelectDesignObject();
    this.saveDialogVisible = true;
    this.saveError = null;
    if (this.categories.length === 0) {
      this.categoriesService.getAllCategories().subscribe({
        next: (data) => {
          this.categories = data;
          this.cdr.detectChanges();
        },
        error: (err) => console.error('Failed to load categories', err),
      });
    }
    this.cdr.detectChanges();
  }

  // mode "update" overwrites the edited tshirt, "new" always creates another one
  async saveDesign(mode: 'update' | 'new' = 'new') {
    if (!this.canSave) return;
    const editing = this.editingTshirt();
    this.saving = true;
    this.saveError = null;
    this.cdr.detectChanges();

    const label = this.tshirtLabel.trim();
    try {
      // Captured before the uploads: the canvas shows the local images either way
      const { file, backFile, printAreas } = await this.captureSides(label);
      await this.uploadLocalDesigns();
      const payload = this.buildPayload(label, printAreas);
      const saved = await firstValueFrom(
        mode === 'update' && editing
          ? this.tshirtsService.updateTshirt(editing.id, file, payload, backFile)
          : this.tshirtsService.addTshirt(file, payload, backFile),
      );
      // Further saves now target the tshirt that was just saved
      this.editingTshirt.set(
        saved._id ? { id: saved._id, label: saved.label } : null,
      );
      this.saveDialogVisible = false;
    } catch (err) {
      console.error('Failed to save design', err);
      this.saveError = 'The design could not be saved, please try again.';
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  // Front capture, plus the back one whenever the template has a back (even without designs)
  private async captureSides(label: string): Promise<{
    file: File;
    backFile?: File;
    printAreas: TshirtPayload['printAreas'];
  }> {
    const currentSide = this.side;
    const printAreas: TshirtPayload['printAreas'] = {};
    try {
      const front = await this.captureSide('front', `${label}.png`);
      if (front.printArea) printAreas.front = front.printArea;
      if (!this.hasBack) return { file: front.file, printAreas };
      const back = await this.captureSide('back', `${label}-back.png`);
      if (back.printArea) printAreas.back = back.printArea;
      return { file: front.file, backFile: back.file, printAreas };
    } finally {
      this.switchSide(currentSide);
    }
  }

  // Also measures what is only known from the DOM while the side is shown
  private async captureSide(
    side: DesignSide,
    fileName: string,
  ): Promise<{ file: File; printArea: SavedPrintArea | null }> {
    this.switchSide(side);
    await this.waitForTemplateImage();
    this.syncTextSizes();
    const area = this.measurePrintArea();
    const printArea = area
      ? { left: area.left, top: area.top, width: area.width, height: area.height }
      : null;
    const dataUrl = await downloadImageLogic('.designer-container');
    if (!dataUrl) throw new Error(`Failed to capture the ${side}`);
    const blob = await (await fetch(dataUrl)).blob();
    return { file: new File([blob], fileName, { type: 'image/png' }), printArea };
  }

  // Texts size themselves from their content: their width/height are only set
  // after a resize, so read the rendered box of the current side's texts
  private syncTextSizes() {
    const canvas: HTMLElement | undefined = this.canvasRef?.nativeElement;
    for (const d of this.sideDesigns) {
      if (d.type !== 'text') continue;
      const el = canvas?.querySelector<HTMLElement>(`#${d.id}`);
      if (!el) continue;
      d.width = el.offsetWidth;
      d.height = el.offsetHeight;
    }
  }

  // Designer state of the tshirt, sent with its captures
  private buildPayload(
    label: string,
    printAreas: TshirtPayload['printAreas'],
  ): TshirtPayload {
    const objects: SavedDesignObject[] = this.designsObject
      // Images are stored by design id (local uploads get one in uploadLocalDesigns)
      .filter((d) => d.type === 'text' || d.design?._id)
      // The back isn't captured for templates without one
      .filter((d) => this.hasBack || sideOf(d) === 'front')
      .map((d): SavedDesignObject => {
        // Local uploads display their blob url: keep the stored design's url
        const design =
          d.design && (this.savedUploads.get(d.design.url) ?? d.design);
        return {
          type: d.type === 'text' ? 'text' : 'image',
          side: sideOf(d),
          design: design?._id,
          designUrl: storedUrlOf(design),
          designLabel: design?.label,
          width: d.width,
          height: d.height,
          left: d.left,
          top: d.top,
          rotation: d.rotation,
          flipX: d.flipX,
          flipY: d.flipY,
          text: d.text ? { ...d.text } : undefined,
        };
      });
    return {
      label,
      color: this.selectedProduct?.color,
      category: this.tshirtCategoryId,
      // Ids of the designs placed on this tshirt (texts have no design)
      designs: uniq(
        objects.map((o) => o.design).filter((id): id is string => !!id),
      ),
      templateId: this.selectedProduct?.id,
      template: this.selectedProduct ? { ...this.selectedProduct } : undefined,
      canvas: this.measureCanvas() ?? undefined,
      printAreas,
      objects,
    };
  }

  private measureCanvas(): CanvasSize | null {
    const canvas: HTMLElement | undefined = this.canvasRef?.nativeElement;
    if (!canvas?.clientWidth || !canvas.clientHeight) return null;
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  }

  private async waitForTemplateImage() {
    const img =
      this.containerRef?.nativeElement.querySelector<HTMLImageElement>(
        '.tshirt-base',
      );
    if (img && !img.complete) {
      await new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }
  }

  // Images uploaded from the browser only exist as local blob urls:
  // store them in the backend so the tshirt can reference them by id
  private async uploadLocalDesigns() {
    const localObjects = this.designsObject.filter(
      (d) => d.type === 'image' && d.design && !d.design._id,
    );
    if (localObjects.length === 0) return;

    for (const object of localObjects) {
      const localUrl = object.design!.url;
      if (!this.savedUploads.has(localUrl)) {
        const blob = await (await fetch(localUrl)).blob();
        const ext = blob.type.split('/')[1]?.replace('+xml', '') || 'png';
        const label = object.design!.label || 'Uploaded image';
        const formData = new FormData();
        formData.append(
          'file',
          new File([blob], `${label}.${ext}`, { type: blob.type }),
        );
        formData.append('label', label);
        formData.append('fromDesigner', 'true');
        const { design } = await firstValueFrom(
          this.designsService.addDesign(formData),
        );
        this.savedUploads.set(localUrl, design);
      }
      // Keep the local url for display, only attach the saved id
      object.design = {
        ...object.design!,
        _id: this.savedUploads.get(localUrl)!._id,
      };
    }
  }

  ngOnDestroy(): void {
    this.designsObjectService.selectDesignObject(this.designsObject);
  }
}

const sideOf = (design: designObject): DesignSide => design.side ?? 'front';

let lastId = 0;
// Also used as DOM ids (drag/resize targets): unique for the whole session
const uniqueId = (prefix: string) => `${prefix}${++lastId}`;

const uniq = <T>(items: T[]): T[] => [...new Set(items)];

// Never save base64 or blob urls: they are the whole image, or only valid in this tab
const storedUrlOf = (design?: DesignModel): string | undefined => {
  const url = design?.storedUrl ?? design?.url;
  return url && !/^(data|blob):/.test(url) ? url : undefined;
};
