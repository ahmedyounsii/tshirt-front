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
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CategoriesService } from '../../../../../../services/categories/categories.service';
import { DesignModel } from '../../../../../../models/design.model';
import { SkeletonModule } from 'primeng/skeleton';
import { DesignsObjectService } from '../../../../../../services/selected-design.service';
import { environment } from '../../../../../../../environments/environment';
import { EmptyComponent } from '../../../../../../components/empty/empty.component';
@Component({
  selector: 'app-designs-dispalyer-items',
  standalone: true,
  imports: [SkeletonModule, EmptyComponent],
  templateUrl: './designs-dispalyer-items.component.html',
  styleUrl: './designs-dispalyer-items.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignsDispalyerItemsComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  baseUrl = environment.baseUrl;

  @Input() selectedCategory: any = null;
  @Input() search = '';
  @ViewChild('designsBody') designsBody!: ElementRef<HTMLElement>;

  private categoriesService = inject(CategoriesService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  // Converted images, so picking the same design again is instant
  private base64Cache = new Map<string, Promise<string>>();

  designsList: DesignModel[] = [];
  loading: boolean = true;
  loadingMore: boolean = false;
  page = 1;
  size = 10;
  count: number = 0;
  skeletons = [1, 2, 3, 4, 5, 6];
  private requestId = 0;

  @Output() doSelectDesign = new EventEmitter<any>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedCategory'] || changes['search']) {
      this.resetDesigns();
    }
  }

  // Listened outside Angular: scrolling runs no change detection until a page has to be loaded
  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() =>
      this.designsBody.nativeElement.addEventListener('scroll', this.onScroll, {
        passive: true,
      }),
    );
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
    const threshold = 50;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      this.zone.run(() => this.loadNextPage());
    }
  };

  resetDesigns() {
    this.page = 1;
    this.count = 0;
    this.designsList = [];
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

    convertToBase64
      .then((base64Url) => {
        const updatedItem = { ...item, url: base64Url };
        this.doSelectDesign.emit(updatedItem);
      })
      .catch((error) => {
        console.error('Failed to convert image to base64 PNG:', error);
        this.doSelectDesign.emit(item); // fallback
      });
  }

  getDesigns() {
    // Ignore responses from outdated requests (category/search changed meanwhile)
    const requestId = ++this.requestId;
    this.categoriesService
      .getAllDesigns(this.selectedCategory, this.page, this.size, this.search)
      .subscribe({
        next: (data: any) => {
          if (requestId !== this.requestId) return;
          this.count = data.count;
          const items = data.items.map((design: any) => ({
            ...design,
            url: `${this.baseUrl}${design.url}`,
            storedUrl: design.url,
          }));
          this.designsList = [...this.designsList, ...items];

          this.loading = false;
          this.loadingMore = false;
          this.cdr.detectChanges();
          // If the list doesn't fill the container yet, no scroll can happen: load more
          this.onScroll();
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
