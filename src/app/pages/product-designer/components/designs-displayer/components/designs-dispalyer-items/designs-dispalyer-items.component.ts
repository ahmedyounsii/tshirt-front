import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CategoriesService } from '../../../../../../services/categories/categories.service';
import { DesignModel, DesignToAdd } from '../../../../../../models/design.model';
import { SkeletonComponent } from '../../../../../../components/skeleton/skeleton.component';
import { DesignsObjectService } from '../../../../../../services/selected-design.service';
import { EmptyComponent } from '../../../../../../components/empty/empty.component';
import { TranslatePipe } from '@ngx-translate/core';
import { isPlatformBrowser } from '@angular/common';
import {
  designsKey,
  DESIGNS_PAGE_SIZE,
  DesignsDisplayerState,
  MasonryDesign,
  toDesign,
  withRatios,
} from '../../designs-displayer.state';

const COLUMNS = 2;

@Component({
    selector: 'app-designs-dispalyer-items',
    imports: [TranslatePipe, SkeletonComponent, EmptyComponent],
    templateUrl: './designs-dispalyer-items.component.html',
    styleUrl: './designs-dispalyer-items.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DesignsDispalyerItemsComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  @Input() selectedCategory: any = null;
  @Input() search = '';
  @ViewChild('designsBody') designsBody!: ElementRef<HTMLElement>;

  private categoriesService = inject(CategoriesService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private state = inject(DesignsDisplayerState);
  private base64Cache = this.state.base64Cache;
  // Designs being added: their tile shows a loader, the other tiles are disabled meanwhile
  addingUrls = new Set<string>();

  designsList: MasonryDesign[] = [];
  // Masonry: each design goes in the shortest column, in loading order
  columns: MasonryDesign[][] = this.emptyColumns();
  private columnHeights: number[] = [];
  loading: boolean = true;
  loadingMore: boolean = false;
  page = 1;
  size = DESIGNS_PAGE_SIZE;
  count: number = 0;
  skeletonColumns = [
    ['140px', '100px', '160px'],
    ['110px', '170px', '120px'],
  ];
  private requestId = 0;

  @Output() doSelectDesign = new EventEmitter<DesignToAdd>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedCategory'] || changes['search']) {
      if (!this.restoreDesigns()) this.resetDesigns();
    }
  }

  // Listened outside Angular: scrolling runs no change detection until a page has to be loaded
  ngAfterViewInit(): void {
    // Back where the list was left
    if (this.state.loaded && !this.loading) {
      this.designsBody.nativeElement.scrollTop = this.state.loaded.scrollTop;
    }
    this.zone.runOutsideAngular(() => {
      this.designsBody.nativeElement.addEventListener('scroll', this.onScroll, {
        passive: true,
      });
      // A restored list (preloaded by the designer) may not fill the panel: no scroll could load more
      setTimeout(this.onScroll);
    });
  }

  ngOnDestroy(): void {
    this.designsBody?.nativeElement.removeEventListener('scroll', this.onScroll);
  }

  get hasMore(): boolean {
    return this.designsList.length < this.count;
  }

  onScroll = () => {
    const el = this.designsBody?.nativeElement;
    if (!el) return;
    // Read here: once the panel is hidden, the element reports 0
    if (this.state.loaded) this.state.loaded.scrollTop = el.scrollTop;
    const threshold = 50;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      this.zone.run(() => this.loadNextPage());
    }
  };

  // The list loaded at a previous opening, for the same category and search
  private restoreDesigns(): boolean {
    const loaded = this.state.loaded;
    if (loaded?.key !== designsKey(this.selectedCategory, this.search)) {
      return false;
    }
    this.requestId++;
    this.page = loaded.page;
    this.count = loaded.count;
    this.designsList = loaded.designs;
    this.columns = this.emptyColumns();
    this.placeInColumns(loaded.designs);
    this.loading = false;
    this.loadingMore = false;
    return true;
  }

  resetDesigns() {
    this.page = 1;
    this.count = 0;
    this.designsList = [];
    this.columns = this.emptyColumns();
    this.loading = true;
    this.loadingMore = false;
    if (this.designsBody) this.designsBody.nativeElement.scrollTop = 0;
    this.getDesigns();
  }

  loadNextPage() {
    if (this.loading || this.loadingMore || !this.hasMore) return;
    this.page++;
    this.loadingMore = true;
    this.cdr.detectChanges();
    this.getDesigns();
  }

  selectDesign(item: DesignModel) {
    if (this.addingUrls.size) return;
    let convertToBase64 = this.base64Cache.get(item.url);
    if (!convertToBase64) {
      const isSvg = item.url.toLowerCase().endsWith('.svg');
      convertToBase64 = isSvg
        ? this.svgUrlToBase64Png(item.url)
        : this.imageUrlToBase64Png(item.url);
      this.base64Cache.set(item.url, convertToBase64);
      // A failed conversion can be retried
      convertToBase64.catch(() => this.base64Cache.delete(item.url));
    }

    const design: DesignToAdd = convertToBase64
      .then((base64Url) => ({ ...item, url: base64Url }))
      .catch((error) => {
        console.error('Failed to convert image to base64 PNG:', error);
        return item; // fallback
      });
    // The tile shows a loader while the image converts
    this.addingUrls.add(item.url);
    this.cdr.detectChanges();
    design.finally(() => {
      this.addingUrls.delete(item.url);
      this.cdr.detectChanges();
    });
    this.doSelectDesign.emit(design);
  }

  getDesigns() {
    // Ignore responses from outdated requests (category/search changed meanwhile)
    const requestId = ++this.requestId;
    this.categoriesService
      .getAllDesigns(this.selectedCategory, this.page, this.size, this.search)
      .subscribe({
        next: (data: any) => {
          if (requestId !== this.requestId) return;
          const items: DesignModel[] = data.items.map(toDesign);
          this.withRatios(items).then((sized) => {
            if (requestId !== this.requestId) return;
            this.count = data.count;
            this.designsList = [...this.designsList, ...sized];
            this.placeInColumns(sized);
            this.state.loaded = {
              key: designsKey(this.selectedCategory, this.search),
              designs: this.designsList,
              count: this.count,
              page: this.page,
              scrollTop: this.designsBody?.nativeElement.scrollTop ?? 0,
            };

            this.loading = false;
            this.loadingMore = false;
            this.cdr.detectChanges();
            // If the list doesn't fill the container yet, no scroll can happen: load more
            this.onScroll();
          });
        },
        error: () => {
          if (requestId !== this.requestId) return;
          if (this.loadingMore) this.page--;
          this.loading = false;
          this.loadingMore = false;
          this.cdr.detectChanges();
        },
      });
  }

  private emptyColumns(): MasonryDesign[][] {
    this.columnHeights = Array(COLUMNS).fill(0);
    return Array.from({ length: COLUMNS }, () => []);
  }

  // Already placed designs stay where they are, so loading a page never reshuffles the list
  private placeInColumns(items: MasonryDesign[]) {
    const columns = this.columns.map((column) => [...column]);
    for (const item of items) {
      const shortest = this.columnHeights.indexOf(
        Math.min(...this.columnHeights),
      );
      columns[shortest].push(item);
      this.columnHeights[shortest] += 1 / item.ratio;
    }
    this.columns = columns;
  }

  // The server render has no images to measure
  private withRatios(items: DesignModel[]): Promise<MasonryDesign[]> {
    if (!this.isBrowser) {
      return Promise.resolve(items.map((item) => ({ ...item, ratio: 1 })));
    }
    return withRatios(items);
  }

  async svgUrlToBase64Png(svgUrl: string): Promise<string> {
    return fetch(svgUrl)
      .then((res) => res.text())
      .then((svgText) => this.renderSvgToBase64(svgText));
  }

  renderSvgToBase64(svgText: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 500;
        canvas.height = img.height || 500;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));

        ctx.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL('image/png');
        resolve(base64);

        URL.revokeObjectURL(url);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  imageUrlToBase64Png(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));

        ctx.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL('image/png');
        resolve(base64);
      };

      img.onerror = reject;
      img.src = imageUrl;
    });
  }
}
