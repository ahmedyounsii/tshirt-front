import { isPlatformBrowser } from '@angular/common';
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
import { SkeletonModule } from 'primeng/skeleton';
import { SITE_URL } from '../../shared/seo.config';
import { TagComponent } from '../../components/tag/tag.component';
import { IconComponent } from '../../components/icon/icon.component';
import { EmptyComponent } from '../../components/empty/empty.component';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';
import { CollectionsService } from '../../services/collections/collections.service';
import { LanguageService } from '../../services/language.service';
import { SeoService } from '../../services/seo.service';
import { DiscountsService } from '../../services/discounts/discounts.service';
import {
  CollectionModel,
  CollectionTextKey,
  collectionLink,
  localized,
} from '../../models/collection.model';
import { CollectionSaleComponent } from '../../shared/collection-sale/collection-sale.component';

const STRUCTURED_DATA_ID = 'collection-structured-data';
// Product pictures are served from the site: crawlers need their full address
const absolute = (url: string) => new URL(url, `${SITE_URL}/`).href;
// Questions of the page, the same for every collection (collectionPage.faq.<key>),
// also sent as FAQPage data
const FAQ = ['print', 'sizes', 'custom', 'delivery'];
// Selling points of the indexed copy, the same for every collection (collectionPage.points.<key>)
const POINTS = [
  { id: 'style', icon: 'pi pi-star' },
  { id: 'quality', icon: 'pi pi-verified' },
  { id: 'gift', icon: 'pi pi-gift' },
];

// Landing page of a collection (/collection/<slug>): its products as in the store,
// then the indexed copy and questions. Made by an admin (/admin/collections).
@Component({
    selector: 'app-collection',
    imports: [
        IconComponent,
        TagComponent,
        TranslatePipe,
        RouterLink,
        SkeletonModule,
        EmptyComponent,
        ProductGalleryComponent,
        CollectionSaleComponent,
    ],
    templateUrl: './collection.component.html',
    styleUrl: './collection.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class.has-wallpaper]': '!!wallpaper()',
        '[style.--page-wallpaper]': 'wallpaper()',
    }
})
export class CollectionComponent {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);
  private collectionsService = inject(CollectionsService);
  private language = inject(LanguageService);
  private seo = inject(SeoService);
  private discounts = inject(DiscountsService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly faq = FAQ;
  readonly points = POINTS;

  readonly collection = signal<CollectionModel | null>(null);
  // Starts true so the server render shows the skeleton, not "not found"
  readonly loading = signal(true);
  // Picture uploaded by the admin, behind the whole page
  readonly wallpaper = computed(() => {
    const url = this.collection()?.wallpaper;
    return url ? `url("${url}")` : null;
  });
  // A live discount is made on the collection: tagged next to its eyebrow
  readonly onSale = computed(() => !!this.discounts.collectionSale(this.collection()?._id));
  // Params of the shared texts: "t-shirts {{name}}"
  readonly nameParams = computed(() => ({ name: this.collection()?.name ?? '' }));

  private request?: Subscription;

  constructor() {
    // The API is only reachable from the browser. The page is reused from one
    // collection to the next, so it follows the slug
    if (this.isBrowser) {
      this.route.paramMap
        .pipe(takeUntilDestroyed())
        .subscribe((params) => this.load(params.get('slug') ?? ''));
    }
    // After the SeoService's own update, which resets the page's tags
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.applySeo());
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      this.document.getElementById(STRUCTURED_DATA_ID)?.remove();
    });
  }

  // A text of the collection in the current language
  text(key: CollectionTextKey): string {
    return localized(this.collection()?.[key], this.language.current());
  }

  private load(slug: string): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.request = this.collectionsService.getCollection(slug).subscribe({
      next: (collection) => {
        this.collection.set(collection);
        this.loading.set(false);
        this.applySeo();
      },
      error: (err) => {
        if (err?.status !== 404) console.error('Failed to load the collection', err);
        this.collection.set(null);
        this.loading.set(false);
      },
    });
  }

  private applySeo(): void {
    const collection = this.collection();
    if (!collection) return;
    this.seo.setPage({
      title: this.text('title'),
      description: this.text('description') || this.text('aboutText'),
      image: collection.products[0] && absolute(collection.products[0].url),
    });
    this.setStructuredData(collection);
  }

  // The collection, its products, the breadcrumb and the questions, for rich results
  private setStructuredData(collection: CollectionModel): void {
    const t = (key: string) => this.translate.instant(key, this.nameParams());
    const url = `${SITE_URL}${collectionLink(collection)}`;
    const name = this.text('title');
    const products = collection.products;

    let script = this.document.getElementById(STRUCTURED_DATA_ID);
    if (!script) {
      script = this.document.createElement('script');
      script.id = STRUCTURED_DATA_ID;
      script.setAttribute('type', 'application/ld+json');
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': `${url}#page`,
          url,
          name,
          description: this.text('description'),
          inLanguage: this.language.current(),
          isPartOf: { '@id': `${SITE_URL}/#website` },
          ...(products[0] && { primaryImageOfPage: absolute(products[0].url) }),
          breadcrumb: { '@id': `${url}#breadcrumb` },
          mainEntity: { '@id': `${url}#items` },
        },
        {
          '@type': 'ItemList',
          '@id': `${url}#items`,
          name,
          numberOfItems: products.length,
          itemListElement: products.map((product, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: product.label,
            image: absolute(product.url),
          })),
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${url}#breadcrumb`,
          itemListElement: [
            { name: t('collectionPage.home'), item: `${SITE_URL}/` },
            { name: t('collectionPage.collections'), item: `${SITE_URL}/collections` },
            { name, item: url },
          ].map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, ...crumb })),
        },
        {
          '@type': 'FAQPage',
          '@id': `${url}#faq`,
          mainEntity: this.faq.map((key) => ({
            '@type': 'Question',
            name: t(`collectionPage.faq.${key}.q`),
            acceptedAnswer: { '@type': 'Answer', text: t(`collectionPage.faq.${key}.a`) },
          })),
        },
      ],
    });
  }
}
