import {
  afterNextRender,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser, NgClass } from '@angular/common';
import { PricePipe } from '../../shared/price.pipe';
import { Router } from '@angular/router';
import {
  designsKey,
  DESIGNS_PAGE_SIZE,
  DesignsDisplayerState,
  toDesign,
  withRatios,
} from './components/designs-displayer/designs-displayer.state';
import { ALL_DESIGNS } from './components/designs-displayer/components/designs-displayer-categories/designs-displayer-categories.component';
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
import { ProductsService } from '../../services/products/products.service';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { DesignsService } from '../../services/designs/design.service';
import { DesignModel, DesignToAdd } from '../../models/design.model';
import { uploadedDesignsService } from '../../services/uploaded-designs.service';
import { filesOf, isFileDrag, MAX_UPLOAD_MB } from '../../shared/image-upload';
import { firstValueFrom } from 'rxjs';
import {
  CanvasSize,
  SavedPrintArea,
  ProductPayload,
  productTypeOf,
} from '../../models/product.model';
import {
  templateImageUrl,
  TemplatesService,
} from '../../services/templates/templates.service';
import { TemplateImagePipe } from '../../shared/template-image.pipe';
import { loadTextFonts } from '../../shared/text-fonts';
import {
  BottomDrawerComponent,
  isMobile,
} from '../../components/bottom-drawer/bottom-drawer.component';
import { TextEditionComponent } from './components/text-edition/text-edition.component';
import {
  ImgPreviewerComponent,
  PreviewView,
} from '../../components/img-previewer/img-previewer.component';
import type { PrintArea } from '../../components/product-3d-viewer/compose-product';
import { LayersPanelComponent } from './components/layers-panel/layers-panel.component';
import {
  modKey,
  ShortcutsCardComponent,
} from './components/shortcuts-card/shortcuts-card.component';
import { AuthService } from '../../services/auth/auth.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PricingService } from '../../services/pricing/pricing.service';
import {
  PriceBreakdown,
  priceBreakdown,
  styleOf,
} from '../../models/pricing.model';
import { changedSides, DesignerHistory } from './logic/designer-history';
import { hasFilter } from '../../shared/design-filters';
import { TagComponent } from '../../components/tag/tag.component';
import { LoaderMaskComponent } from '../../components/loader-mask/loader-mask.component';

// Typing and arrow nudges make one undo step per pause
const EDIT_PAUSE_MS = 500;
// Offset of a duplicated object from its original
const DUPLICATE_OFFSET = 20;
// Longest side of an image when added
const NEW_DESIGN_SIZE = 100;
// Longest the "Loading designer" mask waits for the designs and templates when the page opens
const OPENING_MASK_MAX_MS = 10000;

@Component({
  selector: 'app-product-designer',
  standalone: true,
  imports: [
    TemplateImagePipe,
    TagComponent,
    LoaderMaskComponent,
    TranslatePipe,
    PricePipe,
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
    ShortcutsCardComponent,
  ],
  // Graphics panel state: kept while the designer is open, dropped when leaving it
  providers: [DesignsDisplayerState],
  templateUrl: './product-designer.component.html',
  styleUrl: './product-designer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDesignerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef;
  @ViewChild('configRef') configRef!: ElementRef;
  @ViewChild('containerRef') containerRef!: ElementRef<HTMLElement>;

  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  private selectedProductService = inject(SelectedProductService);
  private designsObjectService = inject(DesignsObjectService);
  private productsService = inject(ProductsService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private categoriesService = inject(CategoriesService);
  private displayerState = inject(DesignsDisplayerState);
  private designsService = inject(DesignsService);
  private pricingService = inject(PricingService);
  private templatesService = inject(TemplatesService);
  private auth = inject(AuthService);
  router = inject(Router);
  readonly uploads = inject(uploadedDesignsService);
  readonly maxUploadMb = MAX_UPLOAD_MB;
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // dragenter / dragleave also fire on each child crossed: counts the elements the drag is in
  private fileDragDepth = 0;
  private removeFileDropListeners?: () => void;
  // Local blob url -> design stored in the backend
  private savedUploads = new Map<string, DesignModel>();
  // Set when leaving for the login page, to find the design again on return
  private keepDesignOnLeave = false;
  // Keyboard shortcuts wait for the delete confirmation
  private confirmingDelete = false;

  readonly history = new DesignerHistory();
  // Shown in the undo/redo tooltips: Ctrl, or ⌘ on Mac
  readonly modKey = modKey();
  private checkpointTimer?: ReturnType<typeof setTimeout>;
  // Opening mask: rendered by the server too, hidden by the browser once the graphics panel's
  // first page and the template images are loaded (OPENING_MASK_MAX_MS at most)
  readonly opening = signal(true);
  // Nothing to design on until an admin adds a template
  readonly noTemplates = computed(
    () =>
      !this.opening() &&
      this.templatesService.loaded() &&
      !this.templatesService.templates().length,
  );
  readonly isAdmin = this.auth.isAdmin;
  private openingTimer?: ReturnType<typeof setTimeout>;

  selectedConfigCategory: any = null;
  // Desktop: the panel shrinks to its category rail, leaving the room to the product
  panelCollapsed = false;
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
    { side: 'front', label: 'common.front' },
    { side: 'back', label: 'common.back' },
  ];
  // Mobile: tapping a text opens its editor in a bottom drawer
  textDrawerOpen = false;
  private pointerDownPos: { x: number; y: number } | null = null;
  private static readonly TAP_MAX_DISTANCE = 5;

  saveDialogVisible = false;
  loginDialogVisible = false;
  saving = false;
  productLabel = '';
  productCategoryId = '';
  saveError: string | null = null;
  categories: DesignCategoryModel[] = [];
  // Saving needs an account: anonymous users are sent to the login page first
  readonly isLoggedIn = this.auth.isLoggedIn;
  // Set when a saved product was opened from "My designs"
  readonly editingProduct = this.designsObjectService.editingProduct;

  get canSave(): boolean {
    return !!this.productLabel.trim() && !!this.productCategoryId && !this.saving;
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

  // Price the product will be sold at, from the shop's price list: same count of
  // images and texts as what buildPayload saves. null when not priced
  get priceEstimate(): PriceBreakdown | null {
    const pricing = this.pricingService.pricing();
    if (!pricing?.configured) return null;
    const saved = this.designsObject.filter(
      (d) => this.hasBack || sideOf(d) === 'front',
    );
    const texts = saved.filter((d) => d.type === 'text').length;
    const designs = saved.filter((d) => d.type !== 'text' && d.design).length;
    return priceBreakdown(pricing, styleOf(this.selectedProduct?.style), designs, texts);
  }

  // Precomputed: called by the template on every check
  countSide(side: DesignSide): number {
    return this.sideCounts[side];
  }

  constructor() {
    if (this.isBrowser) loadTextFonts(inject(DOCUMENT));
    afterNextRender(() => {
      const open = () => {
        clearTimeout(this.openingTimer);
        this.opening.set(false);
      };
      this.openingTimer = setTimeout(open, OPENING_MASK_MAX_MS);
      Promise.all([this.preloadDesigns(), this.preloadTemplates()]).then(open);
    });
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
    this.init();
    if (this.isBrowser) this.listenFileDrops();
  }

  // The upload panel is on screen: it shows the progress and rejections itself
  get uploadPanelVisible(): boolean {
    return this.selectedConfigCategory?.id === 'upload' && !this.selectedDesign;
  }

  // Image files can be dropped anywhere on the page. Bound outside Angular: dragover fires
  // every few ms during a drag, only its start and end change the view
  private listenFileDrops() {
    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      if (this.fileDragDepth++ === 0) this.setDraggingFiles(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      // Accepts the drop: otherwise the browser leaves the designer to open the file
      event.preventDefault();
      event.dataTransfer!.dropEffect = this.canAddFiles() ? 'copy' : 'none';
    };
    const onDragLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      if (--this.fileDragDepth <= 0) this.endFileDrag();
    };
    const onDrop = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      this.endFileDrag();
      if (!this.canAddFiles()) return;
      const files = filesOf(event.dataTransfer);
      this.zone.run(() => this.addFiles(files));
    };

    this.zone.runOutsideAngular(() => {
      window.addEventListener('dragenter', onDragEnter);
      window.addEventListener('dragover', onDragOver);
      window.addEventListener('dragleave', onDragLeave);
      window.addEventListener('drop', onDrop);
    });
    this.removeFileDropListeners = () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }

  private endFileDrag() {
    this.fileDragDepth = 0;
    this.setDraggingFiles(false);
  }

  private setDraggingFiles(dragging: boolean) {
    if (this.uploads.draggingFiles() === dragging) return;
    this.zone.run(() => this.uploads.draggingFiles.set(dragging));
  }

  // Not while saving, or a dialog / the preview covers the designer
  private canAddFiles(): boolean {
    return !(
      this.saving ||
      this.confirmingDelete ||
      this.previewOpen ||
      this.saveDialogVisible ||
      this.loginDialogVisible
    );
  }

  // Ctrl+V of an image: a screenshot, or copied from a website or the file explorer.
  // Texts pasted keep their default behavior
  @HostListener('document:paste', ['$event'])
  onPaste(event: ClipboardEvent) {
    if (!this.canAddFiles() || isEditingTarget(event.target)) return;
    const files = filesOf(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    this.addFiles(files);
  }

  // Dropped or pasted files: checked and downscaled, then placed on the product
  private async addFiles(files: File[]) {
    const added = await this.uploads.addFiles(files);
    for (const design of added) await this.addDesign(design);
    this.cdr.detectChanges();
  }

  private async init() {
    await this.applyPendingEdit();
    await this.applyPendingDesign();
    // Undo stops at the design the designer opened with
    this.history.reset(this.designsObject);
    this.cdr.detectChanges();
  }

  // drag/resize act on the selected object itself: bound again on each selection.
  // Outside Angular: interact.js listens to every pointer move on the document, which
  // would run change detection each time. The page is refreshed on pointerup (onActionEnd)
  private bindSelected() {
    const design = this.selectedDesign;
    if (design) this.zone.runOutsideAngular(() => dragReize(design));
  }

  // A design was picked in the designs gallery: put it on the canvas
  private async applyPendingDesign() {
    if (!this.designsObjectService.pendingDesign) return;
    await this.addDesign(this.designsObjectService.takePendingDesign());
  }

  // A saved product was opened for edition: its objects were placed on a canvas
  // of another size, and its label/category prefill the save dialog
  private async applyPendingEdit() {
    const edit = this.designsObjectService.pendingEdit;
    if (!edit) return;
    this.designsObjectService.pendingEdit = null;
    this.productLabel = edit.label;
    this.productCategoryId = edit.category ?? '';
    if (!edit.canvas?.width || !edit.canvas.height) return;
    // The effect may not have run yet: read the loaded product from the services
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
  // place on the product image (the canvas isn't the same share of the image on every screen)
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
    this.scheduleCheckpoint();
  }

  // An action is over (drag, resize, slider, select...): record it as an undo step,
  // once its handlers ran
  @HostListener('document:pointerup')
  @HostListener('document:change')
  onActionEnd() {
    this.scheduleCheckpoint();
  }

  @HostListener('document:input')
  onTyping() {
    this.scheduleCheckpoint(EDIT_PAUSE_MS);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (
      this.saving ||
      this.confirmingDelete ||
      this.previewOpen ||
      this.saveDialogVisible ||
      this.loginDialogVisible ||
      isEditingTarget(event.target)
    )
      return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (mod && (key === 'z' || key === 'y')) {
      event.preventDefault();
      if (key === 'y' || event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    const design: designObject | null = this.selectedDesign;
    if (!design) return;

    if (mod && key === 'd') {
      event.preventDefault();
      this.duplicateDesignObject(design);
    } else if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      this.deleteDesignObject(design);
    } else if (key === 'escape') {
      this.unSelectDesignObject(true);
    } else if (key in ARROW_MOVES) {
      event.preventDefault();
      const [x, y] = ARROW_MOVES[key];
      const step = event.shiftKey ? 10 : 1;
      design.left += x * step;
      design.top += y * step;
      this.cdr.detectChanges();
      this.scheduleCheckpoint(EDIT_PAUSE_MS);
    }
  }

  undo() {
    // Records what was done since the last step, so it can be redone
    this.history.checkpoint(this.designsObject);
    this.restore(this.history.undo());
  }

  redo() {
    this.history.checkpoint(this.designsObject);
    this.restore(this.history.redo());
  }

  private restore(objects: designObject[] | null) {
    if (!objects) return;
    const sides = changedSides(this.designsObject, objects);
    const selectedId = this.selectedDesign?.id;
    this.designsObject = objects;
    this.designsObjectService.selectDesignObject(this.designsObject);
    // Show the side that changed
    if (!sides.includes(this.side) && sides.length) this.switchSide(sides[0]);
    this.updateSideDesigns();
    // The objects are copies: select the copy of the selected one
    const selected = this.sideDesigns.find((d) => d.id === selectedId);
    this.selectedDesign = null;
    if (selected) this.selectDesignObject(selected);
    else this.unSelectDesignObject(true);
    this.cdr.detectChanges();
  }

  private scheduleCheckpoint(delay = 0) {
    clearTimeout(this.checkpointTimer);
    this.checkpointTimer = setTimeout(() => this.checkpoint(), delay);
  }

  private checkpoint() {
    clearTimeout(this.checkpointTimer);
    this.history.checkpoint(this.designsObject);
    this.cdr.detectChanges();
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
    this.panelCollapsed = false;
  }

  selectDesignObject(designObject: designObject) {
    this.desableUnselect = true;
    // Already selected (mousedown then click): drag/resize is already set up
    if (this.selectedDesign === designObject) return;
    this.selectedDesign = designObject;
    this.bindSelected();
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
    if (moved > ProductDesignerComponent.TAP_MAX_DISTANCE) return;
    this.textDrawerOpen = true;
    this.cdr.detectChanges();
  }

  async addDesign(toAdd: DesignToAdd) {
    // The image may still be converting (the gallery tile shows a loader meanwhile), then it is
    // sized before it shows: fitted on load, the box would shrink and the image jump
    const design = await toAdd;
    if (!design) return;
    const ratio = await imageRatio(design.url);
    const newDesignObject: designObject = {
      id: uniqueId('design_'),
      type: 'image',
      side: this.side,
      url: design.url,
      ...fitToRatio(ratio, NEW_DESIGN_SIZE),
      left: 0,
      top: 0,
      rotation: 0,
      flipX: false,
      flipY: false,
      design,
    };
    this.designsObject.push(newDesignObject);
    this.updateSideDesigns();
    this.selectDesignObject(newDesignObject);
    this.checkpoint();
  }

  // The filter of the selected image was applied: show it, and make it an undo step
  onFilterApplied() {
    this.checkpoint();
  }

  // Ctrl+D: a copy on top of the others, slightly offset so it's visible
  duplicateDesignObject(design: designObject) {
    const copy: designObject = {
      ...design,
      id: uniqueId(design.type === 'text' ? 'text_' : 'design_'),
      left: design.left + DUPLICATE_OFFSET,
      top: design.top + DUPLICATE_OFFSET,
      text: design.text && { ...design.text },
    };
    this.designsObject.push(copy);
    this.updateSideDesigns();
    this.selectDesignObject(copy);
    this.checkpoint();
  }

  // Shrink the box to the image ratio (keeping its longest side) so the frame hugs the image
  fitDesignToImage(design: designObject, event: Event) {
    const img = event.target as HTMLImageElement;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const { width, height } = fitToRatio(
      img.naturalWidth / img.naturalHeight,
      Math.max(design.width, design.height),
    );
    // Already fitted
    if (
      Math.abs(width - design.width) < 1 &&
      Math.abs(height - design.height) < 1
    )
      return;
    design.width = width;
    design.height = height;
    // Part of adding the image, not a step of its own
    this.history.amend(this.designsObject);
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
    this.checkpoint();
  }

  // New back to front order of the current side's objects; the other side keeps its order
  reorderLayers(order: designObject[]) {
    this.designsObject = [
      ...this.designsObject.filter((d) => sideOf(d) !== this.side),
      ...order,
    ];
    this.updateSideDesigns();
    this.designsObjectService.selectDesignObject(this.designsObject);
    this.checkpoint();
  }

  async deleteDesignObject(designObject: designObject, event?: any) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.confirmingDelete = true;
    const ok = await this.confirm
      .confirmDelete(
        this.translate.instant('designer.removeItemMessage'),
        this.translate.instant('designer.removeItem'),
      )
      .finally(() => (this.confirmingDelete = false));
    if (!ok) return;
    this.designsObject = this.designsObject.filter(
      (item) => item.id !== designObject.id,
    );
    this.updateSideDesigns();
    // Keep the current config category open so the user stays where they were
    this.unSelectDesignObject(true);
    this.checkpoint();
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
    const img = this.containerRef?.nativeElement.querySelector('.product-base');
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
      // Both views (2D canvas and 3D) are drawn from the template, the designs and the print area
      for (const side of sides) {
        this.switchSide(side);
        await this.waitForTemplateImage();
        if (!isCurrentRun()) return;
        this.setPreviewView(side, {
          preview: null,
          templateUrl: templateImageUrl(this.templateImg),
          designs: this.sideDesigns,
          // Used to place the designs on the template
          printArea: this.measurePrintArea(),
        });
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
    this.keepDesignOnLeave = true;
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
    // Fetched each time: the admin may have changed the prices meanwhile
    this.pricingService.getPricing().subscribe({
      next: () => this.cdr.detectChanges(),
      error: (err) => console.error('Failed to load the prices', err),
    });
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

  // mode "update" overwrites the edited product, "new" always creates another one
  async saveDesign(mode: 'update' | 'new' = 'new') {
    if (!this.canSave) return;
    const editing = this.editingProduct();
    this.saving = true;
    this.saveError = null;
    this.cdr.detectChanges();

    const label = this.productLabel.trim();
    try {
      // Captured before the uploads: the canvas shows the local images either way
      const { file, backFile, printAreas } = await this.captureSides(label);
      await this.uploadLocalDesigns();
      const payload = this.buildPayload(label, printAreas);
      const saved = await firstValueFrom(
        mode === 'update' && editing
          ? this.productsService.updateProduct(editing.id, file, payload, backFile)
          : this.productsService.addProduct(file, payload, backFile),
      );
      // Further saves now target the product that was just saved
      this.editingProduct.set(
        saved._id ? { id: saved._id, label: saved.label } : null,
      );
      this.saveDialogVisible = false;
    } catch (err) {
      console.error('Failed to save design', err);
      this.saveError = this.translate.instant('designer.saveFailed');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  // Front capture, plus the back one whenever the template has a back (even without designs)
  private async captureSides(label: string): Promise<{
    file: File;
    backFile?: File;
    printAreas: ProductPayload['printAreas'];
  }> {
    const currentSide = this.side;
    const printAreas: ProductPayload['printAreas'] = {};
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

  // Designer state of the product, sent with its captures
  private buildPayload(
    label: string,
    printAreas: ProductPayload['printAreas'],
  ): ProductPayload {
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
          filter: hasFilter(d.filter) ? { type: d.filter.type } : undefined,
        };
      });
    return {
      type: this.selectedProduct ? productTypeOf(this.selectedProduct) : undefined,
      label,
      color: this.selectedProduct?.color,
      category: this.productCategoryId,
      // Ids of the designs placed on this product (texts have no design)
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

  // First page of the graphics panel, kept in its state so the panel opens already filled
  private async preloadDesigns() {
    try {
      const data: any = await firstValueFrom(
        this.categoriesService.getAllDesigns(ALL_DESIGNS, 1, DESIGNS_PAGE_SIZE),
      );
      const designs = await withRatios((data.items || []).map(toDesign));
      this.displayerState.loaded = {
        key: designsKey(ALL_DESIGNS, ''),
        designs,
        count: data.count || 0,
        page: 1,
        scrollTop: 0,
      };
    } catch {
      // The panel loads them itself when opened
    }
  }

  // Waits for the template list, then loads both sides of the shown template.
  // The color picker loads the others lazily; they stay cached once loaded
  private async preloadTemplates() {
    await firstValueFrom(this.templatesService.load());
    const shown = this.selectedProductService.product();
    const images = [shown?.frontImg, shown?.backImg].filter((src): src is string => !!src);
    return Promise.all(
      images.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = img.onerror = resolve;
            img.src = templateImageUrl(src);
          }),
      ),
    );
  }

  private async waitForTemplateImage() {
    const img =
      this.containerRef?.nativeElement.querySelector<HTMLImageElement>(
        '.product-base',
      );
    if (img && !img.complete) {
      await new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }
  }

  // Images uploaded from the browser only exist as local blob urls:
  // store them in the backend so the product can reference them by id
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
    clearTimeout(this.checkpointTimer);
    clearTimeout(this.openingTimer);
    this.removeFileDropListeners?.();
    this.uploads.draggingFiles.set(false);
    this.uploads.errors.set([]);
    // Only the login detour keeps the design, any other exit clears the designer
    if (this.keepDesignOnLeave) {
      this.designsObjectService.selectDesignObject(this.designsObject);
    } else {
      this.designsObjectService.reset();
    }
  }
}

const sideOf = (design: designObject): DesignSide => design.side ?? 'front';

const ARROW_MOVES: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
};

// Keys typed there belong to the field (text, slider, dropdown, dialog), not to the shortcuts
const isEditingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    !!target.closest(
      '[role="slider"], [role="combobox"], [role="listbox"], [role="dialog"], .p-overlay',
    ));

let lastId = 0;
// Also used as DOM ids (drag/resize targets): unique for the whole session
const uniqueId = (prefix: string) => `${prefix}${++lastId}`;

const uniq = <T>(items: T[]): T[] => [...new Set(items)];

// Box with the image ratio, its longest side being size
const fitToRatio = (ratio: number, size: number) => ({
  width: ratio >= 1 ? size : size * ratio,
  height: ratio >= 1 ? size / ratio : size,
});

// Width / height of the image, 1 when it can't be loaded. Same CORS mode as the
// canvas image, so the canvas reuses the loaded file
const imageRatio = (url: string): Promise<number> =>
  new Promise((resolve) => {
    // Server render
    if (typeof Image === 'undefined') return resolve(1);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () =>
      resolve(
        img.naturalWidth && img.naturalHeight
          ? img.naturalWidth / img.naturalHeight
          : 1,
      );
    img.onerror = () => resolve(1);
    img.src = url;
  });

// Never save base64 or blob urls: they are the whole image, or only valid in this tab
const storedUrlOf = (design?: DesignModel): string | undefined => {
  const url = design?.storedUrl ?? design?.url;
  return url && !/^(data|blob):/.test(url) ? url : undefined;
};
