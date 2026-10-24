// TODO: replace both before going live. SITE_URL is the public address of the
// app (with the /tshirt base href, no trailing slash): canonical links, social
// cards and structured data are built from it. Keep public/robots.txt and
// public/sitemap.xml in sync with it.
export const SITE_URL = 'https://www.example.tn/tshirt';
export const SITE_NAME = 'Spellprint';

// Picture shown when a page is shared (Facebook, WhatsApp, X...)
export const SHARE_IMAGE = `${SITE_URL}/assets/banners/banner_1.png`;
export const LOGO_IMAGE = `${SITE_URL}/assets/icons/spellprint_logo.png`;

// Translation group of a route's meta tags (seo.<key>.title / seo.<key>.description),
// set as `data: { seo }` in app.routes.ts. Only indexable pages are in the sitemap.
export type SeoKey =
  | 'home'
  | 'store'
  | 'designs'
  | 'allCollections'
  | 'designer'
  | 'auth'
  | 'checkout'
  | 'account'
  | 'admin'
  // Landing page of a collection, until its own texts are loaded (see SeoService.setPage)
  | 'collection';

export type SeoRouteData = {
  seo: SeoKey;
  // Private, admin and transactional pages stay out of search results
  noindex?: boolean;
  // Picture of the page when shared, SHARE_IMAGE when missing
  image?: string;
};

// Locale announced to social networks for each UI language
export const OG_LOCALES = { fr: 'fr_FR', en: 'en_US' } as const;
