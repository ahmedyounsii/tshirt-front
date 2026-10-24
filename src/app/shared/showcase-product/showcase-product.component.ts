import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { TagComponent } from '../../components/tag/tag.component';
import { ProductModel } from '../../models/product.model';
import { PreviewService } from '../../services/preview/preview.service';
import { ProductsService } from '../../services/products/products.service';
import { environment } from '../../../environments/environment';

// Newest saved products the stage picks from, and how many it shows
const SHOWCASE_POOL = 24;
const SHOWCASE_SIZE = 4;
// Fixed text of the showcase
const SHOWCASE_COPY = {
  title: 'showcaseProduct.title',
  description: 'showcaseProduct.description',
};
// Selling points listed under the text
const SHOWCASE_PERKS = [
  { icon: 'pi pi-box', label: 'showcaseProduct.perks.preview3d' },
  { icon: 'pi pi-sync', label: 'showcaseProduct.perks.frontBack' },
  { icon: 'pi pi-check-circle', label: 'showcaseProduct.perks.madeToOrder' },
];

const pad = (n: number) => String(n).padStart(2, '0');

// A few items in a random order (Fisher-Yates on a copy)
const pickRandom = <T>(items: T[], count: number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
};

// Home teaser: one big tee on a stage, picked from a thumbnail rail, opened in the previewer.
// The tees are a random few of the newest saved products, loaded in the browser
@Component({
  selector: 'app-showcase-product',
  standalone: true,
  imports: [TagComponent, TranslatePipe, RouterLink, SkeletonModule],
  templateUrl: './showcase-product.component.html',
  styleUrl: './showcase-product.component.scss',
})
export class ShowcaseProductComponent implements OnInit {
  private previewer = inject(PreviewService);
  private productsService = inject(ProductsService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly copy = SHOWCASE_COPY;
  readonly perks = SHOWCASE_PERKS;
  // Skeleton thumbnails while the products load
  readonly placeholders = Array.from({ length: SHOWCASE_SIZE }, (_, i) => i);

  readonly products = signal<ProductModel[]>([]);
  // Until the request ends, the stage shows skeletons
  readonly loading = signal(true);

  readonly active = signal(0);
  // undefined while loading, or when no product is saved yet
  readonly current = computed(() => this.products()[this.active()]);
  // The thumbnail rail only shows once it can be filled, the arrows are enough otherwise
  readonly showThumbs = computed(
    () => this.loading() || this.products().length >= SHOWCASE_SIZE,
  );
  // "02 / 05" counter of the stage
  readonly counter = computed(
    () => `${pad(this.active() + 1)} / ${pad(this.products().length)}`,
  );

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.productsService
      .getProductsPage({ page: 1, size: SHOWCASE_POOL })
      .subscribe({
        next: (page) => {
          // Urls are stored relative to the server, like in the store
          const saved = page.items
            .filter((product) => product.url)
            .map((product) => ({
              ...product,
              url: environment.baseUrl + product.url,
              backUrl: product.backUrl ? environment.baseUrl + product.backUrl : undefined,
            }));
          this.products.set(pickRandom(saved, SHOWCASE_SIZE));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  select(index: number): void {
    this.active.set(index);
  }

  // Previous / next arrows, wrapping around both ends
  step(delta: number): void {
    const n = this.products().length;
    if (!n) return;
    this.active.update((i) => (i + delta + n) % n);
  }

  // Full screen preview of the tee on the stage, like in the store: drawn from its
  // designer state, so it can be turned in 3D and shows its back when it has one
  preview(): void {
    const product = this.current();
    if (product) this.previewer.open(product);
  }
}
