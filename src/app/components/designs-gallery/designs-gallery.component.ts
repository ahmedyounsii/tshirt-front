import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  model,
  OnChanges,
  OnInit,
  Output,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { Subscription } from 'rxjs';
import { DesignsService } from '../../services/designs/design.service';
import { CategoriesService } from '../../services/categories/categories.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { DesignModel } from '../../models/design.model';
import { environment } from '../../../environments/environment';
import { DesignCardComponent } from '../design-card/design-card.component';
import {
  CategoryChipsComponent,
  ChipItem,
  toCategoryChips,
} from '../category-chips/category-chips.component';
import { SearchInputComponent } from '../search-input/search-input.component';
import { EmptyComponent } from '../empty/empty.component';
import {
  ImgPreviewerComponent,
  PreviewView,
} from '../img-previewer/img-previewer.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { DesignsObjectService } from '../../services/selected-design.service';

export const ALL_DESIGNS = 'all_designs';

export type DesignsGalleryNotice = {
  type: 'success' | 'error';
  message: string;
};

// Designs list loaded by chunks ("Show more") with category filter and search, all done by the server.
// Header actions go in [galleryActions], anything else projected shows under the header
@Component({
  selector: 'app-designs-gallery',
  standalone: true,
  imports: [
    TranslatePipe,
    SkeletonModule,
    ButtonModule,
    DesignCardComponent,
    CategoryChipsComponent,
    SearchInputComponent,
    EmptyComponent,
    ImgPreviewerComponent,
  ],
  templateUrl: './designs-gallery.component.html',
  styleUrl: './designs-gallery.component.scss',
})
export class DesignsGalleryComponent implements OnInit, OnChanges {
  private designsService = inject(DesignsService);
  private categoriesService = inject(CategoriesService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private designsObjectService = inject(DesignsObjectService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Used for the filter chips and the subtitle
  @Input() categories: DesignCategoryModel[] = [];
  // Translation key (or plain text)
  @Input() title = 'common.designs';
  // Shows a delete button on each design (admin)
  @Input() deletable = false;
  // Designs fetched on first load, then on each "Show more"
  @Input() pageSize = 10;
  // Button of the empty state (translation key), hidden when empty
  @Input() emptyButtonLabel = '';
  // Shows a "Use it" button on each design, opening the designer with it on the canvas
  @Input() openInDesigner = false;

  // Selected category id, or ALL_DESIGNS
  category = model(ALL_DESIGNS);

  @Output() deleted = new EventEmitter<DesignModel>();
  @Output() notify = new EventEmitter<DesignsGalleryNotice>();
  @Output() emptyAction = new EventEmitter<void>();

  designs: DesignModel[] = [];
  // Starts true so the server render shows the skeleton, not the empty state
  loading = true;
  // "Show more" request in flight: the loaded designs stay visible
  loadingMore = false;
  count = 0;
  // Last page loaded, so designs shown = page * pageSize (at most)
  page = 1;
  private request?: Subscription;
  search = '';
  deletingId: string | null = null;
  // Clicked design, shown in the 2D previewer
  preview: PreviewView | null = null;
  chips: ChipItem[] = toCategoryChips([], ALL_DESIGNS);

  get hasMore(): boolean {
    return this.designs.length < this.count;
  }

  get categoryLabel(): string {
    return (
      this.categories.find((c) => c._id === this.category())?.label ||
      'common.allDesigns'
    );
  }

  ngOnChanges(): void {
    // Designer uploads category is internal: keep it out of the filter chips
    this.chips = toCategoryChips(
      this.categories.filter((c) => c.label.toLowerCase() !== 'uploads'),
      ALL_DESIGNS,
    );
  }

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.reload();
  }

  // Starts over from the first chunk. Also called by the parent after a change it made (upload, category deleted...)
  reload() {
    this.page = 1;
    this.loading = true;
    this.fetch(1, this.pageSize, (items) => (this.designs = items));
  }

  loadMore() {
    if (this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;
    const next = this.page + 1;
    this.fetch(next, this.pageSize, (items) => {
      this.page = next;
      this.designs = [...this.designs, ...items];
    });
  }

  // Fetches again everything already shown in one request, keeping the list length
  private refresh() {
    this.fetch(1, this.page * this.pageSize, (items) => (this.designs = items));
  }

  private fetch(page: number, size: number, apply: (items: DesignModel[]) => void) {
    // A newer request (search, filter...) wins over a pending one
    this.request?.unsubscribe();
    this.request = this.categoriesService
      .getAllDesigns(this.category(), page, size, this.search)
      .subscribe({
        next: (data: any) => {
          this.count = data.count || 0;
          apply(
            (data.items || []).map((design: any) => ({
              ...design,
              url: `${environment.baseUrl}${design.url}`,
              storedUrl: design.url,
            })),
          );
          this.loading = this.loadingMore = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = this.loadingMore = false;
          this.notify.emit({ type: 'error', message: this.translate.instant('designsGallery.loadFailed') });
          this.cdr.detectChanges();
        },
      });
  }

  useDesign(design: DesignModel) {
    this.designsObjectService.pendingDesign = design;
    this.router.navigate(['/designer']);
  }

  // 2D only: without a templateUrl the previewer hides its 3D toggle
  openPreview(design: DesignModel) {
    this.preview = {
      preview: design.url,
      templateUrl: null,
      designs: [],
      printArea: null,
    };
  }

  selectCategory(id: string) {
    this.category.set(id);
    this.reload();
  }

  onSearch(value: string) {
    this.search = value;
    if (value.length > 2 || value.length === 0) this.reload();
  }

  async deleteDesign(design: DesignModel) {
    if (!design._id || this.deletingId) return;
    const name = design.label || this.translate.instant('designsGallery.thisDesign');
    const ok = await this.confirm.confirmDelete(
      this.translate.instant('designsGallery.deleteMessage', { name }),
      this.translate.instant('designsGallery.deleteDesign'),
    );
    if (!ok || this.deletingId) return;

    this.deletingId = design._id;
    this.designsService.deleteDesign(design._id).subscribe({
      next: () => {
        this.deletingId = null;
        this.notify.emit({
          type: 'success',
          message: this.translate.instant('designsGallery.deleted', { name }),
        });
        this.deleted.emit(design);
        // Drop it right away, then refetch so the list fills back up
        this.designs = this.designs.filter((d) => d._id !== design._id);
        this.count = Math.max(0, this.count - 1);
        this.refresh();
      },
      error: () => {
        this.deletingId = null;
        this.notify.emit({ type: 'error', message: this.translate.instant('designsGallery.deleteFailed') });
        this.cdr.detectChanges();
      },
    });
  }
}
