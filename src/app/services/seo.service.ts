
import { inject, Injectable, DOCUMENT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter, merge } from 'rxjs';
import {
  LOGO_IMAGE,
  OG_LOCALES,
  SHARE_IMAGE,
  SHOP_CONTACT,
  SITE_NAME,
  SITE_URL,
  SOCIAL_LINKS,
  SeoRouteData,
} from '../shared/seo.config';

const STRUCTURED_DATA_ID = 'seo-structured-data';

// Title, description, canonical, social cards and structured data of the
// current page. Runs during prerendering too, so crawlers get them in the HTML.
@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private title = inject(Title);
  private meta = inject(Meta);
  private document = inject(DOCUMENT);

  // Called once at startup (see app.component.ts)
  init() {
    merge(
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd)),
      this.translate.onLangChange,
    ).subscribe(() => this.update());
  }

  // Pages whose texts come from the API (a collection) set them once loaded,
  // and again on each language change. title gets the brand appended.
  setPage(page: { title: string; description: string; image?: string }) {
    const data = this.routeData();
    this.apply(
      `${page.title} | ${SITE_NAME}`,
      page.description,
      page.image ?? data.image ?? SHARE_IMAGE,
      data.noindex,
    );
  }

  private update() {
    const data = this.routeData();
    const key = `seo.${data.seo}`;
    this.apply(
      this.translate.instant(`${key}.title`, { brand: SITE_NAME }),
      this.translate.instant(`${key}.description`),
      data.image ?? SHARE_IMAGE,
      data.noindex,
    );
  }

  private apply(title: string, description: string, image: string, noindex?: boolean) {
    const lang = (this.translate.currentLang ?? 'fr') as keyof typeof OG_LOCALES;
    const url = this.canonicalUrl();

    this.title.setTitle(title);
    this.setName('description', description);
    this.setName('keywords', this.translate.instant('seo.keywords'));
    this.setName('robots', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');

    this.setProperty('og:type', 'website');
    this.setProperty('og:site_name', SITE_NAME);
    this.setProperty('og:locale', OG_LOCALES[lang] ?? OG_LOCALES.fr);
    this.setProperty('og:title', title);
    this.setProperty('og:description', description);
    this.setProperty('og:url', url);
    this.setProperty('og:image', image);
    this.setProperty('og:image:alt', this.translate.instant('seo.imageAlt'));

    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', title);
    this.setName('twitter:description', description);
    this.setName('twitter:image', image);

    this.setCanonical(url);
    this.setStructuredData(description);
  }

  // Data of the deepest active route, the page being shown
  private routeData(): SeoRouteData {
    let route = this.route.snapshot;
    while (route.firstChild) route = route.firstChild;
    return (route.data as Partial<SeoRouteData>).seo
      ? (route.data as SeoRouteData)
      : { seo: 'home', noindex: true };
  }

  // Query params (search, filters) and fragments don't make a different page
  private canonicalUrl(): string {
    const path = this.router.url.split(/[?#]/)[0];
    return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
  }

  private setName(name: string, content: string) {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string) {
    this.meta.updateTag({ property, content });
  }

  private setCanonical(url: string) {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }

  // The shop and the site, for Google's knowledge panel and sitelinks
  private setStructuredData(description: string) {
    let script = this.document.getElementById(STRUCTURED_DATA_ID);
    if (!script) {
      script = this.document.createElement('script');
      script.id = STRUCTURED_DATA_ID;
      script.setAttribute('type', 'application/ld+json');
      this.document.head.appendChild(script);
    }
    const { email, telephone, address } = SHOP_CONTACT;
    const sameAs = SOCIAL_LINKS.map((social) => social.url).filter(Boolean);
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          // A clothing store (local business) needs an address, an online store doesn't
          '@type': address.streetAddress ? ['OnlineStore', 'ClothingStore'] : 'OnlineStore',
          '@id': `${SITE_URL}/#store`,
          name: SITE_NAME,
          url: `${SITE_URL}/`,
          logo: LOGO_IMAGE,
          image: SHARE_IMAGE,
          description,
          ...(email && { email }),
          ...(telephone && { telephone }),
          ...(address.streetAddress && {
            address: { '@type': 'PostalAddress', ...address },
            priceRange: '$$',
          }),
          ...(sameAs.length && { sameAs }),
          areaServed: { '@type': 'Country', name: 'Tunisie' },
          currenciesAccepted: 'TND',
          paymentAccepted: 'Cash on delivery',
          knowsAbout: [
            't-shirt personnalisé',
            't-shirt personnalisé anime',
            't-shirt film',
            't-shirt musique',
            't-shirt avec photo',
            'sweat personnalisé',
            'impression textile',
          ],
        },
        {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          name: SITE_NAME,
          url: `${SITE_URL}/`,
          inLanguage: ['fr', 'en'],
          publisher: { '@id': `${SITE_URL}/#store` },
        },
      ],
    });
  }
}
