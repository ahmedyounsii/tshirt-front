import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { CategoryChipsComponent, ChipItem } from '../../../components/category-chips/category-chips.component';
import { EmptyComponent } from '../../../components/empty/empty.component';
import { ProductDetailsDialogComponent } from '../../../components/product-details-dialog/product-details-dialog.component';
import { SearchInputComponent } from '../../../components/search-input/search-input.component';
import { DesignCategoryModel } from '../../../models/design-catergory.model';
import { ProductModel } from '../../../models/product.model';
import { SellerProduct, SellerProductsPage } from '../../../models/seller.model';
import { CategoriesService } from '../../../services/categories/categories.service';
import { ConfirmService } from '../../../services/confirm/confirm.service';
import { ProductsService } from '../../../services/products/products.service';
import { DesignsObjectService } from '../../../services/selected-design.service';
import { SellerService } from '../../../services/seller/seller.service';
import { avatarUrl, AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { PricePipe } from '../../../shared/price.pipe';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';

const PAGE_SIZE = 20;
// Same cap as the server (services/pricing.js)
const MAX_PRICE = 10000;

// Seller: their products with what each one sold and earned. Shown in the store or hidden,
// priced (their own price, or the shop's price list), opened in the designer to edit, or
// deleted. New products are made in the designer, with the seller's designs or any other
@Component({
  selector: 'app-seller-products',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    SkeletonModule,
    CategoryChipsComponent,
    EmptyComponent,
    ProductDetailsDialogComponent,
    SearchInputComponent,
    AvatarUrlPipe,
    PricePipe,
    DialogComponent,
  ],
  templateUrl: './seller-products.component.html',
  styleUrl: './seller-products.component.scss',
})
export class SellerProductsComponent implements OnInit {
  private sellerService = inject(SellerService);
  private productsService = inject(ProductsService);
  private categoriesService = inject(CategoriesService);
  private designsObjectService = inject(DesignsObjectService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly page = signal<SellerProductsPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly visibility = signal<'' | 'published' | 'hidden'>('');
  readonly search = signal('');
  readonly pageIndex = signal(1);
  // Products being changed (toggle, delete, edit)
  readonly busy = signal<Set<string>>(new Set());
  readonly error = signal<string | null>(null);

  readonly chips = computed<ChipItem[]>(() => {
    const counts = this.page()?.counts;
    return [
      { id: '', label: 'common.all', count: counts?.all },
      { id: 'published', label: 'sellerDash.products.published', count: counts?.published },
      { id: 'hidden', label: 'sellerDash.products.hidden', count: counts?.hidden },
    ];
  });

  readonly pages = computed(() => {
    const page = this.page();
    return page ? Math.max(1, Math.ceil(page.count / page.size)) : 1;
  });

  // Details dialog (name, category, tags), the same as the store's "Edit"
  readonly detailsProduct = signal<ProductModel | null>(null);
  readonly categories = signal<DesignCategoryModel[]>([]);

  // Price dialog
  readonly priced = signal<SellerProduct | null>(null);
  readonly priceOpen = signal(false);
  priceInput = '';
  readonly priceError = signal<string | null>(null);

  ngOnInit() {
    if (!this.isBrowser) return;
    this.load();
    this.categoriesService.getAllCategories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: (err) => console.error('Failed to load categories', err),
    });
  }

  openDetails(product: SellerProduct) {
    const { _id, label, url, category, tags } = product;
    // The dialog shows the image as is: served by the API server, like the store's cards
    this.detailsProduct.set({ _id, label, url: avatarUrl(url), category, tags } as ProductModel);
  }

  onDetailsSaved() {
    this.detailsProduct.set(null);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.sellerService
      .getProducts({ page: this.pageIndex(), size: PAGE_SIZE, search: this.search(), visibility: this.visibility() })
      .subscribe({
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

  onVisibility(id: string) {
    this.visibility.set(id as '' | 'published' | 'hidden');
    this.pageIndex.set(1);
    this.load();
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

  isBusy(id: string) {
    return this.busy().has(id);
  }

  private setBusy(id: string, busy: boolean) {
    this.busy.update((set) => {
      const next = new Set(set);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  togglePublished(product: SellerProduct) {
    this.setBusy(product._id, true);
    this.error.set(null);
    this.productsService
      .setPublished(product._id, !product.published)
      .subscribe({
        next: () => {
          this.setBusy(product._id, false);
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.setBusy(product._id, false);
          this.error.set(err.error?.message || this.translate.instant('sellerDash.actionFailed'));
        },
      });
  }

  create() {
    this.router.navigate(['/designer']);
  }

  // The full product (designer state included), then the designer in edit mode
  redesign(product: SellerProduct) {
    this.setBusy(product._id, true);
    this.productsService.getProduct(product._id).subscribe({
      next: async (full) => {
        try {
          await this.designsObjectService.loadProduct(full);
          this.router.navigate(['/designer']);
        } finally {
          this.setBusy(product._id, false);
        }
      },
      error: () => {
        this.setBusy(product._id, false);
        this.error.set(this.translate.instant('sellerDash.actionFailed'));
      },
    });
  }

  async remove(product: SellerProduct) {
    const ok = await this.confirm.confirmDelete(
      this.translate.instant('sellerDash.products.deleteText', { name: product.label }),
    );
    if (!ok) return;
    this.setBusy(product._id, true);
    this.productsService.deleteProduct(product._id).subscribe({
      next: () => {
        this.setBusy(product._id, false);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.setBusy(product._id, false);
        this.error.set(err.error?.message || this.translate.instant('sellerDash.actionFailed'));
      },
    });
  }

  openPrice(product: SellerProduct) {
    this.priced.set(product);
    this.priceInput = product.customPrice !== null ? String(product.customPrice) : '';
    this.priceError.set(null);
    this.priceOpen.set(true);
  }

  // Empty: back to the shop's price list
  savePrice() {
    const product = this.priced();
    if (!product) return;
    const raw = this.priceInput.trim().replace(',', '.');
    const price = raw === '' ? null : Number(raw);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > MAX_PRICE)) {
      this.priceError.set(this.translate.instant('sellerDash.products.priceInvalid'));
      return;
    }
    this.setBusy(product._id, true);
    this.productsService.updatePrice(product._id, price).subscribe({
      next: () => {
        this.setBusy(product._id, false);
        this.priceOpen.set(false);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.setBusy(product._id, false);
        this.priceError.set(err.error?.message || this.translate.instant('sellerDash.actionFailed'));
      },
    });
  }
}
