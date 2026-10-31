import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { DesignEditDialogComponent, DesignEdit } from '../../../components/design-edit-dialog/design-edit-dialog.component';
import { EmptyComponent } from '../../../components/empty/empty.component';
import { SearchInputComponent } from '../../../components/search-input/search-input.component';
import { DesignCategoryModel } from '../../../models/design-catergory.model';
import { DesignModel } from '../../../models/design.model';
import { SellerDesign, SellerDesignsPage } from '../../../models/seller.model';
import { CategoriesService } from '../../../services/categories/categories.service';
import { ConfirmService } from '../../../services/confirm/confirm.service';
import { DesignsService } from '../../../services/designs/design.service';
import { SellerService } from '../../../services/seller/seller.service';
import { avatarUrl, AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { PreviewService } from '../../../services/preview/preview.service';

const PAGE_SIZE = 24;

// Seller: the artwork they shared (transparent, print-ready images), with the products using
// each one. Shown in the public gallery or hidden: products already made with a hidden design
// keep it. New designs go through the usual share form, with its print checks
@Component({
    selector: 'app-seller-designs',
    imports: [
        RouterLink,
        TranslatePipe,
        ButtonModule,
        SkeletonModule,
        DesignEditDialogComponent,
        EmptyComponent,
        SearchInputComponent,
        AvatarUrlPipe,
    ],
    templateUrl: './seller-designs.component.html',
    styleUrl: './seller-designs.component.scss'
})
export class SellerDesignsComponent implements OnInit {
  private sellerService = inject(SellerService);
  private designService = inject(DesignsService);
  private categoriesService = inject(CategoriesService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private previewer = inject(PreviewService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly page = signal<SellerDesignsPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly search = signal('');
  readonly pageIndex = signal(1);
  readonly busy = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  // Edit dialog (name, tags, categories), the same as the designs gallery's
  readonly editing = signal<DesignModel | null>(null);
  readonly categories = signal<DesignCategoryModel[]>([]);

  readonly pages = computed(() => {
    const page = this.page();
    return page ? Math.max(1, Math.ceil(page.count / page.size)) : 1;
  });

  ngOnInit() {
    if (!this.isBrowser) return;
    this.load();
    this.categoriesService.getAllCategories().subscribe({
      // Designer uploads category is internal
      next: (categories) => this.categories.set(categories.filter((c) => c.label.toLowerCase() !== 'uploads')),
      error: (err) => console.error('Failed to load categories', err),
    });
  }

  edit(design: SellerDesign) {
    const { _id, label, url, tags, categoryIds } = design;
    // The dialog shows the image as is: served by the API server, like the gallery's cards
    this.editing.set({ _id, label, url: avatarUrl(url), tags, categoryIds });
  }

  onSaved({ label, tags }: DesignEdit) {
    const id = this.editing()?._id;
    this.editing.set(null);
    this.page.update((page) =>
      page && { ...page, items: page.items.map((d) => (d._id === id ? { ...d, label, tags } : d)) },
    );
    this.load();
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.sellerService.getDesigns({ page: this.pageIndex(), size: PAGE_SIZE, search: this.search() }).subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  onSearch(search: string) {
    this.search.set(search);
    this.pageIndex.set(1);
    this.load();
  }

  goTo(page: number) {
    this.pageIndex.set(page);
    this.load();
  }

  preview(design: SellerDesign) {
    this.previewer.openImage(avatarUrl(design.url));
  }

  togglePublished(design: SellerDesign) {
    this.busy.set(design._id);
    this.error.set(null);
    this.designService.updateDesign(design._id, { published: !design.published }).subscribe({
      next: () => {
        this.busy.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(null);
        this.error.set(err.error?.message || this.translate.instant('sellerDash.actionFailed'));
      },
    });
  }

  async remove(design: SellerDesign) {
    const message = design.usedCount
      ? this.translate.instant('sellerDash.designs.deleteUsed', { name: design.label, count: design.usedCount })
      : this.translate.instant('sellerDash.designs.deleteText', { name: design.label });
    if (!(await this.confirm.confirmDelete(message))) return;
    this.busy.set(design._id);
    this.designService.deleteDesign(design._id).subscribe({
      next: () => {
        this.busy.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(null);
        this.error.set(err.error?.message || this.translate.instant('sellerDash.actionFailed'));
      },
    });
  }
}
