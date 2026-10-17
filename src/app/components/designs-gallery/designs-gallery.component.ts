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
import { PaginatorModule } from 'primeng/paginator';
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

export const ALL_DESIGNS = 'all_designs';

export type DesignsGalleryNotice = {
  type: 'success' | 'error';
  message: string;
};

// Paginated designs list with category filter and search, all done by the server.
// Header actions go in [galleryActions], anything else projected shows under the header
@Component({
  selector: 'app-designs-gallery',
  standalone: true,
  imports: [
    SkeletonModule,
    PaginatorModule,
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
  private cdr = inject(ChangeDetectorRef);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Used for the filter chips and the subtitle
  @Input() categories: DesignCategoryModel[] = [];
  @Input() title = 'Designs';
  // Shows a delete button on each design (admin)
  @Input() deletable = false;
  @Input() pageSizes = [12, 24, 48];
  // Button of the empty state, hidden when empty
  @Input() emptyButtonLabel = '';

  // Selected category id, or ALL_DESIGNS
  category = model(ALL_DESIGNS);

  @Output() deleted = new EventEmitter<DesignModel>();
  @Output() notify = new EventEmitter<DesignsGalleryNotice>();
  @Output() emptyAction = new EventEmitter<void>();

  designs: DesignModel[] = [];
  // Starts true so the server render shows the skeleton, not the empty state
  loading = true;
  count = 0;
  page = 1;
  size = 12;
  search = '';
  deletingId: string | null = null;
  // Clicked design, shown in the 2D previewer
  preview: PreviewView | null = null;
  chips: ChipItem[] = toCategoryChips([], ALL_DESIGNS);

  get categoryLabel(): string {
    return (
      this.categories.find((c) => c._id === this.category())?.label ||
      'All designs'
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
    this.size = this.pageSizes[0];
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.reload();
  }

  // Also called by the parent after a change it made (upload, category deleted...)
  reload(page = this.page) {
    this.page = page;
    this.loading = true;
    this.categoriesService
      .getAllDesigns(this.category(), this.page, this.size, this.search)
      .subscribe({
        next: (data: any) => {
          this.count = data.count || 0;
          this.designs = (data.items || []).map((design: any) => ({
            ...design,
            url: `${environment.baseUrl}${design.url}`,
          }));
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.notify.emit({ type: 'error', message: 'Failed to load designs' });
          this.cdr.detectChanges();
        },
      });
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
    this.reload(1);
  }

  onSearch(value: string) {
    this.search = value;
    if (value.length > 2 || value.length === 0) this.reload(1);
  }

  onPageChange(event: any) {
    this.size = event.rows;
    this.reload(event.page + 1);
  }

  async deleteDesign(design: DesignModel) {
    if (!design._id || this.deletingId) return;
    const name = design.label || 'this design';
    const ok = await this.confirm.confirmDelete(`Delete "${name}"?`, 'Delete design');
    if (!ok || this.deletingId) return;

    this.deletingId = design._id;
    this.designsService.deleteDesign(design._id).subscribe({
      next: () => {
        this.deletingId = null;
        this.notify.emit({ type: 'success', message: `Design "${name}" deleted` });
        this.deleted.emit(design);
        // Step back a page if we just removed the last item on it
        const page =
          this.designs.length === 1 && this.page > 1 ? this.page - 1 : this.page;
        this.reload(page);
      },
      error: () => {
        this.deletingId = null;
        this.notify.emit({ type: 'error', message: 'Failed to delete design' });
        this.cdr.detectChanges();
      },
    });
  }
}
