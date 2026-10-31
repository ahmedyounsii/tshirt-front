import { isPlatformBrowser, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
  DOCUMENT
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { EmptyComponent } from '../../components/empty/empty.component';
import { QtyStepperComponent } from '../../components/qty-stepper/qty-stepper.component';
import { TagComponent } from '../../components/tag/tag.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PricePipe } from '../../shared/price.pipe';
import { SalePriceComponent } from '../../shared/sale-price/sale-price.component';
import { DiscountsService } from '../../services/discounts/discounts.service';
import { CURRENCY } from '../../shared/currency.config';
import { SIZE_GUIDE } from '../../shared/checkout.config';
import { DeliveryService } from '../../services/delivery/delivery.service';
import { SITE_NAME, SITE_URL } from '../../shared/seo.config';
import { environment } from '../../../environments/environment';
import { DesignSide } from '../../models/design-object.model';
import { ProductModel } from '../../models/product.model';
import { creatorDisplayName, creatorLink } from '../../models/user.model';
import {
  MAX_QUANTITY,
  PRODUCT_SIZES,
  ProductSize,
  SizeQuantity,
} from '../../models/cart.model';
import { ProductsService } from '../../services/products/products.service';
import { CategoriesService } from '../../services/categories/categories.service';
import { TemplatesService } from '../../services/templates/templates.service';
import { CartService } from '../../services/cart/cart.service';
import { PreviewService } from '../../services/preview/preview.service';
import { SeoService } from '../../services/seo.service';

const STRUCTURED_DATA_ID = 'product-structured-data';
// Similar products shown under the product
const RELATED_COUNT = 4;
// Same id as the server's filter for products without a known category
const OTHER = 'other';
// Product pictures are served from the site: crawlers need their full address
const absolute = (url: string) => new URL(url, `${SITE_URL}/`).href;
// Selling points under the buy button (store.perks.<id>)
const PERKS = [
  { id: 'quality', icon: 'pi pi-star' },
  { id: 'fast', icon: 'pi pi-bolt' },
  { id: 'shipping', icon: 'pi pi-truck' },
];

// Page of one product (/product/<id>), opened from a product card: its front and back,
// sizes and quantities to add to the cart (like the "Shop now" dialog), its details,
// then similar products
@Component({
    selector: 'app-product',
    imports: [
        RouterLink,
        TranslatePipe,
        PricePipe,
        SalePriceComponent,
        ButtonModule,
        SkeletonModule,
        EmptyComponent,
        QtyStepperComponent,
        TagComponent,
        IconComponent,
    ],
    templateUrl: './product.component.html',
    styleUrl: './product.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductComponent {
  router = inject(Router);
  cart = inject(CartService);
  private discounts = inject(DiscountsService);
  previewer = inject(PreviewService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private document = inject(DOCUMENT);
  private translate = inject(TranslateService);
  private productsService = inject(ProductsService);
  private categoriesService = inject(CategoriesService);
  private templatesService = inject(TemplatesService);
  private seo = inject(SeoService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private baseUrl = environment.baseUrl;

  readonly sizes = PRODUCT_SIZES;
  readonly sizeGuide = SIZE_GUIDE;
  // Lowest amount some delivery option is free from, null when none is
  readonly freeShippingFrom = inject(DeliveryService).freeShippingFrom;
  readonly perks = PERKS;

  readonly product = signal<ProductModel | null>(null);
  // Starts true so the server render shows the skeleton, not "not found"
  readonly loading = signal(true);
  readonly related = signal<ProductModel[]>([]);
  private categories = signal<{ _id: string; label: string }[]>([]);

  side = signal<DesignSide>('front');
  quantities = signal<Partial<Record<ProductSize, number>>>({});
  showGuide = signal(false);
  adding = signal(false);
  failed = signal(false);
  // "Link copied" feedback of the share button
  copied = signal(false);

  readonly forSale = computed(() => this.product()?.price != null);

  readonly template = computed(() => {
    const product = this.product();
    return this.templatesService.byId(product?.templateId) ?? product?.template ?? null;
  });

  // Label of the category tag; null for missing or deleted ones, which show no tag
  readonly categoryLabel = computed(() => {
    const id = this.product()?.category;
    if (!id || id === OTHER) return null;
    return this.categories().find((c) => c._id === id)?.label || null;
  });

  // Previous route; the shop when the page was opened directly (no in-app history)
  goBack() {
    if (this.isBrowser && window.history.state?.navigationId > 1) this.location.back();
    else this.router.navigate(['/stores']);
  }

  // Who designed the product: their store's name while it is open, else their username;
  // hidden for admin-made ones (the shop's own designs)
  readonly creatorName = computed(() => {
    const creator = this.product()?.createdBy;
    if (!creator || creator.role === 'admin') return null;
    return creatorDisplayName(creator) || null;
  });

  // Store of the creator (the user's own store page for their own products)
  readonly creatorLink = computed(() => {
    const creator = this.product()?.createdBy;
    if (!creator) return null;
    return creatorLink(creator);
  });

  readonly picks = computed<SizeQuantity[]>(() =>
    this.sizes
      .map((size) => ({ size, quantity: this.quantities()[size] ?? 0 }))
      .filter((p) => p.quantity > 0),
  );
  readonly totalQuantity = computed(() =>
    this.picks().reduce((sum, p) => sum + p.quantity, 0),
  );
  // Discount included
  readonly total = computed(() => this.discounts.unitPrice(this.product()) * this.totalQuantity());

  private request?: Subscription;
  private relatedRequest?: Subscription;
  private copiedTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // The API is only reachable from the browser. The page is reused from one
    // product to the next (similar products), so it follows the id
    if (this.isBrowser) {
      this.categoriesService
        .getAllCategories()
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (categories) => this.categories.set(categories),
          error: (err) => console.error('Failed to load categories', err),
        });
      this.route.paramMap
        .pipe(takeUntilDestroyed())
        .subscribe((params) => this.load(params.get('id') ?? ''));
    }
    // After the SeoService's own update, which resets the page's tags
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.applySeo());
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      this.relatedRequest?.unsubscribe();
      clearTimeout(this.copiedTimer);
      this.document.getElementById(STRUCTURED_DATA_ID)?.remove();
    });
  }

  // Captures are stored relative to the API
  private withUrls(product: ProductModel): ProductModel {
    return {
      ...product,
      url: `${this.baseUrl}${product.url}`,
      backUrl: product.backUrl ? `${this.baseUrl}${product.backUrl}` : undefined,
    };
  }

  private load(id: string): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    // Every product opens on its front with a clean selection
    this.side.set('front');
    this.quantities.set({});
    this.showGuide.set(false);
    this.failed.set(false);
    this.related.set([]);
    this.request = this.productsService.getProduct(id).subscribe({
      next: (product) => {
        const shown = this.withUrls(product);
        this.product.set(shown);
        this.loading.set(false);
        this.applySeo();
        this.loadRelated(shown);
      },
      error: (err) => {
        if (err?.status !== 404) console.error('Failed to load the product', err);
        this.product.set(null);
        this.loading.set(false);
      },
    });
  }

  // Newest products of the same type and category (the section hides when there are none)
  private loadRelated(product: ProductModel): void {
    this.relatedRequest?.unsubscribe();
    const category = product.category || OTHER;
    this.relatedRequest = this.productsService
      .getProductsPage({ page: 1, size: RELATED_COUNT + 1, type: product.type, category })
      .subscribe({
        next: (page) => {
          const items = page.items
            .filter((p) => p._id !== product._id)
            .slice(0, RELATED_COUNT)
            .map((p) => this.withUrls(p));
          this.related.set(items);
        },
        error: (err) => console.error('Failed to load similar products', err),
      });
  }

  // Template key of e.g. "Oversize · Beige"
  styleKey(): string {
    const t = this.template();
    return t ? `templates.styles.${t.style || t.type}` : '';
  }

  colorKey(): string {
    const t = this.template();
    return t ? `templates.colors.${t.colorLabel}` : '';
  }

  // Picture of the side shown in the main frame
  sideUrl(product: ProductModel): string {
    return this.side() === 'back' && product.backUrl ? product.backUrl : product.url;
  }

  openPreview(product: ProductModel) {
    this.previewer.open(product, this.side());
  }

  quantity(size: ProductSize): number {
    return this.quantities()[size] ?? 0;
  }

  inCart(size: ProductSize): number {
    return this.cart.quantityOf(this.product()?._id, size);
  }

  // What can still be added on top of what's already in the cart
  maxFor(size: ProductSize): number {
    return Math.max(0, MAX_QUANTITY - this.inCart(size));
  }

  setQuantity(size: ProductSize, quantity: number) {
    this.failed.set(false);
    this.quantities.update((q) => ({ ...q, [size]: Math.max(0, quantity) }));
  }

  // Adds the picked sizes, then the cart drawer opens on them
  async addToCart() {
    const product = this.product();
    if (!product || !this.totalQuantity() || this.adding()) return;
    this.adding.set(true);
    this.failed.set(false);
    try {
      await this.cart.add(product, this.picks());
      this.quantities.set({});
    } catch (err) {
      console.error('Failed to add to the cart', err);
      this.failed.set(true);
    } finally {
      this.adding.set(false);
    }
  }

  // Native share sheet on phones, the link copied elsewhere
  async share() {
    const product = this.product();
    if (!product) return;
    const url = this.document.location.href;
    const nav = this.document.defaultView?.navigator;
    try {
      if (nav?.share) {
        await nav.share({ title: product.label, url });
        return;
      }
      await nav?.clipboard.writeText(url);
      this.copied.set(true);
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Share sheet dismissed, or clipboard not allowed
    }
  }

  private applySeo(): void {
    const product = this.product();
    if (!product) return;
    const params = { label: product.label };
    this.seo.setPage({
      title: this.translate.instant('productPage.seoTitle', params),
      description: this.translate.instant('productPage.seoDescription', params),
      image: absolute(product.url),
    });
    this.setStructuredData(product);
  }

  // The product and its offer, for rich results
  private setStructuredData(product: ProductModel): void {
    let script = this.document.getElementById(STRUCTURED_DATA_ID);
    if (!script) {
      script = this.document.createElement('script');
      script.id = STRUCTURED_DATA_ID;
      script.setAttribute('type', 'application/ld+json');
      this.document.head.appendChild(script);
    }
    const url = `${SITE_URL}/product/${product._id}`;
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${url}#product`,
      url,
      name: product.label,
      description: this.translate.instant('productPage.seoDescription', {
        label: product.label,
      }),
      image: [product.url, product.backUrl].filter(Boolean).map((u) => absolute(u!)),
      brand: { '@type': 'Brand', name: SITE_NAME },
      ...(product.price != null && {
        offers: {
          '@type': 'Offer',
          url,
          price: product.price.toFixed(2),
          priceCurrency: CURRENCY.code,
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
      }),
    });
  }
}
