// SITE_URL is the public address of the app (no trailing slash): canonical
// links, social cards and structured data are built from it. Keep
// public/robots.txt and public/sitemap.xml in sync with it.
export const SITE_URL = 'https://spellprint.shop';
export const SITE_NAME = 'Spellprint';

// Picture shown when a page is shared (Facebook, WhatsApp, X...)
export const SHARE_IMAGE = `${SITE_URL}/assets/banners/banner_1.jpg`;
export const LOGO_IMAGE = `${SITE_URL}/assets/icons/spellprint_logo.png`;

// Profiles of the shop on social networks: linked in the footer and listed in the
// structured data (sameAs), so search engines tie them to the site.
// A network without a url is left out everywhere
export const SOCIAL_LINKS: { label: string; icon: string; url: string }[] = [
  { label: 'Instagram', icon: 'pi pi-instagram', url: '' },
  { label: 'Facebook', icon: 'pi pi-facebook', url: '' },
  { label: 'TikTok', icon: 'pi pi-tiktok', url: '' },
  { label: 'X', icon: 'pi pi-twitter', url: '' },
  { label: 'YouTube', icon: 'pi pi-youtube', url: '' },
  { label: 'LinkedIn', icon: 'pi pi-linkedin', url: '' },
];

// Contact details of the shop. Once address is filled, the structured data also
// presents the shop as a local business (Google Maps, local results)
export const SHOP_CONTACT = {
  email: '',
  // International format, e.g. +216 XX XXX XXX
  telephone: '',
  address: {
    streetAddress: '',
    addressLocality: '',
    postalCode: '',
    addressCountry: 'TN',
  },
};

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
  | 'seller'
  | 'maintenance'
  // Landing page of a collection, until its own texts are loaded (see SeoService.setPage)
  | 'collection'
  // Public profile of a creator, until they are loaded (see SeoService.setPage)
  | 'creator'
  // Page of one product, until it is loaded (see SeoService.setPage)
  | 'product';

export type SeoRouteData = {
  seo: SeoKey;
  // Private, admin and transactional pages stay out of search results
  noindex?: boolean;
  // Picture of the page when shared, SHARE_IMAGE when missing
  image?: string;
};

// Locale announced to social networks for each UI language
export const OG_LOCALES = { fr: 'fr_FR', en: 'en_US' } as const;
