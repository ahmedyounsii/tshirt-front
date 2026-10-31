import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  DOCUMENT
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PricePipe } from '../../shared/price.pipe';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { TranslatePipe } from '@ngx-translate/core';
import { OrdersService } from '../../services/orders/orders.service';
import { PreviewService } from '../../services/preview/preview.service';
import { LanguageService } from '../../services/language.service';
import {
  ORDER_STATUS_TAG,
  OrderPrintItem,
  OrderPrintSheet,
} from '../../models/order.model';
import { PRODUCT_SIZES, ProductSize } from '../../models/cart.model';
import { DesignSide, SavedDesignObject } from '../../models/design-object.model';
import { CanvasSize } from '../../models/product.model';
import { EmptyComponent } from '../../components/empty/empty.component';
import { TemplatesService } from '../../services/templates/templates.service';
import { loadTextFonts } from '../../shared/text-fonts';
import { TextCanvasDirective } from '../../shared/text-canvas.directive';
import { CM_PER_INCH, MIN_PRINT_DPI, PRINT_AREA_CM } from '../../shared/print.config';
import { environment } from '../../../environments/environment';
import {
  renderDesignFilter,
  hasFilter,
  PRINT_FILTER_SIZE,
} from '../../shared/design-filters';
import { TagComponent } from '../../components/tag/tag.component';

// Within this distance of the zone's middle, a layer counts as centered
const CENTERED_CM = 0.3;
// Delay before a downloaded print file is freed
const DOWNLOAD_RELEASE_MS = 30_000;

type Garment = { style: string; colorLabel: string; color: string; ref: string };

// One image or text of a side, measured on the printed product
export type PrintLayer = {
  // 1-based, matches the marker on the placement diagram
  index: number;
  object: SavedDesignObject;
  artworkUrl: string | null;
  fileName: string | null;
  // Box on the diagram, as % of the canvas
  box: { left: number; top: number; width: number; height: number };
  // Printed size, and position of the box's center (x from the zone's middle,
  // positive to the right) and top edge (from the zone's top), in cm
  widthCm: number;
  heightCm: number;
  offsetXCm: number;
  topCm: number;
};

export type PrintSide = {
  side: DesignSide;
  mockupUrl: string | null;
  canvas: CanvasSize;
  zone: { widthCm: number; heightCm: number };
  layers: PrintLayer[];
};

export type PrintJob = {
  index: number;
  item: OrderPrintItem;
  mockupUrl: string;
  backMockupUrl: string | null;
  garment: Garment | null;
  sides: PrintSide[];
};

type Artwork = { width: number; height: number };

// Admin: the production sheet of one order, laid out for A4 printing: what to pick,
// where every artwork and text goes on each side, and where it ships
@Component({
    selector: 'app-order-print',
    imports: [TagComponent, PricePipe, RouterLink, TranslatePipe, SkeletonComponent, EmptyComponent, TextCanvasDirective],
    templateUrl: './order-print.component.html',
    styleUrl: './order-print.component.scss'
})
export class OrderPrintComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private ordersService = inject(OrdersService);
  private templatesService = inject(TemplatesService);
  private language = inject(LanguageService);
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  previewer = inject(PreviewService);

  readonly minDpi = MIN_PRINT_DPI;
  readonly statusTag = ORDER_STATUS_TAG;
  readonly printedOn = new Date();
  // Texts are drawn sharp enough for the printed sheet
  readonly printTextRatio = 4;

  order = signal<OrderPrintSheet | null>(null);
  loading = signal(true);
  failed = signal(false);
  // Natural size of each artwork, read once its image loads
  private artworks = signal<ReadonlyMap<string, Artwork>>(new Map());
  // Artworks whose filtered file is being made
  filtering = signal<ReadonlySet<string>>(new Set());

  jobs = computed<PrintJob[]>(() =>
    (this.order()?.items ?? []).map((item, i) => this.jobOf(item, i + 1)),
  );

  pieces = computed(() =>
    (this.order()?.items ?? []).reduce((sum, i) => sum + i.quantity, 0),
  );

  // Pieces per size, in size order, for picking the blanks
  sizes = computed(() => {
    const counts = new Map<ProductSize, number>();
    for (const i of this.order()?.items ?? []) {
      counts.set(i.size, (counts.get(i.size) ?? 0) + i.quantity);
    }
    return PRODUCT_SIZES.filter((s) => counts.has(s)).map((size) => ({
      size,
      count: counts.get(size)!,
    }));
  });

  ngOnInit(): void {
    if (this.isBrowser) loadTextFonts(this.document);
    this.load();
  }

  load() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loading.set(true);
    this.failed.set(false);
    this.ordersService
      .getPrintSheet(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.loading.set(false);
          this.loadArtworks();
        },
        error: (err) => {
          console.error('Failed to load the production sheet', err);
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  print() {
    if (this.isBrowser) window.print();
  }

  // Drawn from the item's print data, like the workshop will print it
  preview(job: PrintJob, side: DesignSide = 'front') {
    this.previewer.open(
      {
        ...job.item.print,
        templateId: job.item.templateId,
        url: job.mockupUrl,
        backUrl: job.backMockupUrl,
      },
      side,
    );
  }

  date(value: string | Date, withTime = false): string {
    return new Date(value).toLocaleDateString(this.language.current(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  }

  cm(value: number): string {
    return (Math.round(value * 10) / 10).toLocaleString(this.language.current());
  }

  // Effective resolution of an artwork at its printed size; null until its image loads
  dpi(layer: PrintLayer): number | null {
    const art = layer.artworkUrl && this.artworks().get(layer.artworkUrl);
    if (!art) return null;
    // The image is contained in its box: its printed width may be less than the box's
    const fit = Math.min(layer.widthCm / art.width, layer.heightCm / art.height);
    return Math.round(CM_PER_INCH / fit);
  }

  // The stored artwork is the original: the effect is applied here, at print size
  async downloadFiltered(layer: PrintLayer) {
    const url = layer.artworkUrl;
    const filter = layer.object.filter;
    if (!url || !hasFilter(filter) || this.filtering().has(url)) return;
    this.filtering.update((set) => new Set(set).add(url));
    try {
      const filtered = await renderDesignFilter(url, filter, PRINT_FILTER_SIZE);
      const link = this.document.createElement('a');
      link.href = filtered;
      link.download = `${(layer.fileName || 'artwork').replace(/\.[^.]+$/, '')}-${filter.type}.png`;
      link.click();
      // A print file is several MB: free it once the browser has started the download
      setTimeout(() => URL.revokeObjectURL(filtered), DOWNLOAD_RELEASE_MS);
    } catch (err) {
      console.error('Failed to apply the effect to the artwork', err);
    } finally {
      this.filtering.update((set) => {
        const next = new Set(set);
        next.delete(url);
        return next;
      });
    }
  }

  hasFlip(o: SavedDesignObject): boolean {
    return o.flipX || o.flipY;
  }

  transform(o: SavedDesignObject): string {
    return (
      `rotate(${o.rotation || 0}deg)` +
      (o.flipX ? ' scaleX(-1)' : '') +
      (o.flipY ? ' scaleY(-1)' : '')
    );
  }

  // Designer px scaled with the diagram (cqw: % of the zone's width)
  canvasUnit(px: number, side: PrintSide): string {
    return `${(px / side.canvas.width) * 100}cqw`;
  }

  // Grid every 5 cm, as % of the zone
  gridSize(side: PrintSide): string {
    return `${(5 / side.zone.widthCm) * 100}% ${(5 / side.zone.heightCm) * 100}%`;
  }

  isDark(color: string | undefined): boolean {
    const hex = (color ?? '').replace('#', '');
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    if (full.length !== 6) return false;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  }

  private jobOf(item: OrderPrintItem, index: number): PrintJob {
    const print = item.print;
    const template =
      print?.template ?? this.templatesService.byId(item.templateId);
    const objects = print?.objects ?? [];
    const canvas = print?.canvas;

    const sides: PrintSide[] = [];
    if (canvas?.width && canvas.height) {
      // The canvas is printed as large as fits the print area
      const cmPerPx = Math.min(
        PRINT_AREA_CM.width / canvas.width,
        PRINT_AREA_CM.height / canvas.height,
      );
      const zone = { widthCm: canvas.width * cmPerPx, heightCm: canvas.height * cmPerPx };
      for (const side of ['front', 'back'] as DesignSide[]) {
        const onSide = objects.filter((o) => (o.side ?? 'front') === side);
        if (!onSide.length) continue;
        const capture = side === 'front' ? item.url : item.backUrl;
        sides.push({
          side,
          mockupUrl: capture ? absolute(capture) : null,
          canvas,
          zone,
          layers: onSide.map((o, i) => layerOf(o, i + 1, canvas, cmPerPx, zone.widthCm)),
        });
      }
    }

    return {
      index,
      item,
      mockupUrl: absolute(item.url),
      backMockupUrl: item.backUrl ? absolute(item.backUrl) : null,
      garment: template
        ? {
            style: template.style || template.type,
            colorLabel: template.colorLabel,
            color: template.color,
            ref: template.ref,
          }
        : null,
      sides,
    };
  }

  private loadArtworks() {
    if (!this.isBrowser) return;
    const urls = new Set(
      this.jobs().flatMap((j) =>
        j.sides.flatMap((s) => s.layers.map((l) => l.artworkUrl).filter((u): u is string => !!u)),
      ),
    );
    for (const url of urls) {
      const img = new Image();
      img.onload = () =>
        this.artworks.update((map) =>
          new Map(map).set(url, { width: img.naturalWidth, height: img.naturalHeight }),
        );
      img.src = url;
    }
  }
}

const layerOf = (
  o: SavedDesignObject,
  index: number,
  canvas: CanvasSize,
  cmPerPx: number,
  zoneWidthCm: number,
): PrintLayer => {
  const artworkUrl = o.type === 'image' && o.designUrl ? absolute(o.designUrl) : null;
  const widthCm = o.width * cmPerPx;
  return {
    index,
    object: o,
    artworkUrl,
    fileName: artworkUrl
      ? decodeURIComponent(artworkUrl.split('?')[0].split('/').pop() || '')
      : null,
    box: {
      left: (o.left / canvas.width) * 100,
      top: (o.top / canvas.height) * 100,
      width: (o.width / canvas.width) * 100,
      height: (o.height / canvas.height) * 100,
    },
    widthCm,
    heightCm: o.height * cmPerPx,
    offsetXCm: snap(o.left * cmPerPx + widthCm / 2 - zoneWidthCm / 2),
    topCm: o.top * cmPerPx,
  };
};

// Tiny offsets come from dragging by hand: treat them as centered
const snap = (offset: number): number => (Math.abs(offset) < CENTERED_CM ? 0 : offset);

// Stored paths are relative to the backend
const absolute = (url: string): string =>
  /^(https?:|data:|blob:)/.test(url) ? url : `${environment.baseUrl}${url}`;
