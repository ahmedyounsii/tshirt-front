import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SliderComponent } from '../../../../components/slider/slider.component';
import { ToggleSwitchComponent } from '../../../../components/toggleswitch/toggleswitch.component';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DEFAULT_GRUNGE_PARAMS,
  fitSize,
  GRUNGE_PRESET_NAMES,
  GRUNGE_PRESETS,
  GRUNGE_SLIDERS,
  GrungeOption,
  GrungeParams,
  GrungePreset,
  GrungeRequest,
  GrungeResponse,
  GrungeSlider,
  loadGrungeSource,
} from '../../../../shared/grunge-edge';
import { MAX_IMAGE_SIDE } from '../../../../shared/image-upload';

const PREVIEW_MAX = 800;

interface SliderControl {
  id: GrungeSlider;
  icon: string;
  min: number;
  max: number;
}

const control = (id: GrungeSlider, icon: string): SliderControl => ({ id, icon, ...GRUNGE_SLIDERS[id] });

// Shirt colors to check how the transparent edge prints
const BACKGROUNDS = [
  { id: 'checker', color: null },
  { id: 'black', color: '#111111' },
  { id: 'white', color: '#f4f1ec' },
  { id: 'navy', color: '#1f2a44' },
  { id: 'red', color: '#8a1f24' },
] as const;
type BackgroundId = (typeof BACKGROUNDS)[number]['id'];

// Adds a grunge brush edge to the design being uploaded. The effect is rendered by a web worker;
// the upload form asks for the result with exportFile(): rendered at full size only then
@Component({
    selector: 'app-grunge-editor',
    imports: [TranslatePipe, NgTemplateOutlet, FormsModule, SliderComponent, ToggleSwitchComponent],
    templateUrl: './grunge-editor.component.html',
    styleUrl: './grunge-editor.component.scss'
})
export class GrungeEditorComponent implements OnChanges, AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @Input() file: File | null = null;
  @ViewChild('view') viewRef?: ElementRef<HTMLCanvasElement>;

  readonly presets = GRUNGE_PRESET_NAMES;
  readonly backgrounds = BACKGROUNDS;
  readonly edgeControls = [control('border', 'sp-icon sp-stop-square'), control('radius', 'sp-icon sp-stop-circle'), control('rough', 'sp-icon sp-pulse')];
  readonly optionControls: Record<GrungeOption, SliderControl> = {
    grunge: control('grunge', 'sp-icon sp-apps-grid-1'),
    chip: control('chip', 'sp-icon sp-full-screen'),
    spray: control('spray', 'sp-icon sp-sparkles'),
    streak: control('streak', 'sp-icon sp-edit-1'),
    smoke: control('smoke', 'sp-icon sp-cloud-1'),
    scuffs: control('scuffs', 'sp-icon sp-record'),
    scratches: control('scratches', 'sp-icon sp-minus'),
    cracks: control('cracks', 'sp-icon sp-flash'),
  };
  readonly optionOrder = Object.keys(this.optionControls) as GrungeOption[];

  params: GrungeParams = { ...DEFAULT_GRUNGE_PARAMS };
  // No preset: the design is uploaded as it is
  preset: GrungePreset | null = null;
  showAllOptions = false;
  showOriginal = false;
  background: BackgroundId = 'checker';
  sizeLabel = '';

  private worker?: Worker;
  // The picked image at preview size, shown for "None" and while holding the original
  private original: HTMLCanvasElement | null = null;
  private seed = 7;
  private frame = 0;
  private loadId = 0;

  // Requests to the worker. Responses older than the current image are dropped
  private nextId = 0;
  private sourceId = 0;
  // One preview at a time: changes made meanwhile are rendered once it's back, never queued
  // Settings key of the preview being rendered
  private inflight: string | null = null;
  // The settings changed since the last preview request
  private dirty = false;
  // The last preview and its settings: shown again without rendering (after holding the original)
  private last: { key: string; bitmap: ImageBitmap } | null = null;
  private pendingExport: { id: number; resolve: (file: File | null) => void } | null = null;

  get ready(): boolean {
    return !!this.original;
  }

  get active(): boolean {
    return !!this.preset && this.ready;
  }

  get visibleOptions(): GrungeOption[] {
    if (this.showAllOptions) return this.optionOrder;
    return this.preset ? this.optionOrder.filter((o) => GRUNGE_PRESETS[this.preset!].options.includes(o)) : [];
  }

  get backgroundColor(): string | null {
    return BACKGROUNDS.find((b) => b.id === this.background)?.color ?? null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['file'] && this.isBrowser) this.loadSource();
  }

  ngAfterViewInit(): void {
    this.schedule();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    this.worker?.terminate();
    this.last?.bitmap.close();
    this.pendingExport?.resolve(null);
  }

  selectPreset(name: GrungePreset | null) {
    this.preset = name;
    if (name) Object.assign(this.params, GRUNGE_PRESETS[name].values);
    this.schedule();
  }

  valueOf(id: GrungeSlider): number {
    return this.params[id];
  }

  setValue<K extends keyof GrungeParams>(key: K, value: GrungeParams[K]) {
    this.params[key] = value;
    this.schedule();
  }

  shuffle() {
    this.seed = (Math.random() * 1e6) | 0;
    this.schedule();
  }

  hold(on: boolean) {
    if (this.showOriginal === on) return;
    this.showOriginal = on;
    this.schedule();
  }

  onHoldKey(event: KeyboardEvent, on: boolean) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    this.hold(on);
  }

  // The file to upload: the design with its grunge edge, or the picked file when no preset is chosen.
  // Null when even a smaller render is over the upload limit
  exportFile(): Promise<File | null> {
    if (!this.file) return Promise.resolve(null);
    if (!this.active || !this.worker) return Promise.resolve(this.file);
    const id = this.nextId++;
    const request: GrungeRequest = { type: 'export', id, params: { ...this.params }, seed: this.seed, name: this.file.name };
    return new Promise((resolve) => {
      this.pendingExport?.resolve(null);
      this.pendingExport = { id, resolve };
      this.worker!.postMessage(request);
    });
  }

  private async loadSource() {
    const id = ++this.loadId;
    this.original = null;
    this.preset = null;
    this.sizeLabel = '';
    this.forgetLast();
    if (!this.file) return;
    try {
      const src = await loadGrungeSource(this.file, MAX_IMAGE_SIDE);
      // Another file was picked meanwhile
      if (id !== this.loadId) return;
      const bitmap = await createImageBitmap(src);
      if (id !== this.loadId) return bitmap.close();

      const [w, h] = fitSize(src, PREVIEW_MAX);
      const original = document.createElement('canvas');
      original.width = w;
      original.height = h;
      original.getContext('2d')!.drawImage(src, 0, 0, w, h);
      this.sizeLabel = `${src.width} × ${src.height}`;
      src.width = src.height = 0;

      this.sourceId = this.nextId;
      this.post({ type: 'source', bitmap }, [bitmap]);
      this.original = original;
      this.schedule();
    } catch {
      this.sizeLabel = '';
    }
  }

  private post(message: GrungeRequest, transfer: Transferable[] = []) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./grunge.worker', import.meta.url), { type: 'module' });
      // Outside Angular: a preview changes nothing in the template
      this.zone.runOutsideAngular(() => {
        this.worker!.onmessage = ({ data }: MessageEvent<GrungeResponse>) => this.onMessage(data);
      });
    }
    this.worker.postMessage(message, transfer);
  }

  private onMessage(data: GrungeResponse) {
    if (data.type === 'export') {
      if (this.pendingExport?.id !== data.id) return;
      const { resolve } = this.pendingExport;
      this.pendingExport = null;
      // Back in Angular: the upload form updates its button and toasts
      this.zone.run(() => resolve(data.file));
      return;
    }
    const key = this.inflight;
    this.inflight = null;
    const { id, bitmap } = data;
    if (!key || id < this.sourceId || !this.active || this.showOriginal) bitmap.close();
    else {
      // Painted even when the settings changed meanwhile: keeps the preview moving during a slider drag
      this.paint(bitmap);
      this.forgetLast();
      this.last = { key, bitmap };
    }
    this.requestPreview();
  }

  // Coalesces the changes made in one frame, outside Angular
  private schedule() {
    if (!this.isBrowser) return;
    this.dirty = true;
    cancelAnimationFrame(this.frame);
    this.zone.runOutsideAngular(() => {
      this.frame = requestAnimationFrame(() => this.requestPreview());
    });
  }

  private requestPreview() {
    if (!this.original || !this.viewRef) return;
    if (!this.active || this.showOriginal) {
      this.dirty = false;
      this.paint(this.original);
      return;
    }
    if (!this.dirty || this.inflight) return;
    this.dirty = false;
    const key = this.key();
    if (this.last?.key === key) {
      this.paint(this.last.bitmap);
      return;
    }
    this.inflight = key;
    this.post({ type: 'preview', id: this.nextId++, max: PREVIEW_MAX, params: { ...this.params }, seed: this.seed });
  }

  private paint(image: HTMLCanvasElement | ImageBitmap) {
    const view = this.viewRef?.nativeElement;
    if (!view) return;
    view.width = image.width;
    view.height = image.height;
    view.getContext('2d')!.drawImage(image, 0, 0);
  }

  // Everything the preview depends on
  private key(): string {
    return JSON.stringify([this.sourceId, this.seed, this.params]);
  }

  private forgetLast() {
    this.last?.bitmap.close();
    this.last = null;
  }
}
