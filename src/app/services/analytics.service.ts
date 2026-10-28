import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';

type Tracker = ((...args: unknown[]) => void) & Record<string, unknown>;
type TrackedWindow = Window & { dataLayer?: unknown[]; gtag?: Tracker; fbq?: Tracker; _fbq?: Tracker };

// Visit statistics (Google Analytics 4) and the Meta pixel (Facebook / Instagram ads).
// Each one stays off until its id is set in environment.prod.ts. Their scripts load once
// the page is idle so they don't slow down the first render, and every in-app
// navigation counts as a page view.
@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Called once at startup (see app.component.ts), after SeoService so page views get the new title
  init() {
    const { gaMeasurementId, metaPixelId } = environment;
    const win = this.document.defaultView as TrackedWindow | null;
    if (!this.isBrowser || !win || (!gaMeasurementId && !metaPixelId)) return;

    // Both stubs queue the calls made before their script is loaded (official snippets)
    if (gaMeasurementId) {
      win.dataLayer = win.dataLayer || [];
      win.gtag = function () {
        win.dataLayer!.push(arguments);
      } as Tracker;
      win.gtag('js', new Date());
      // Page views are sent on each navigation below, the first one included
      win.gtag('config', gaMeasurementId, { send_page_view: false });
    }
    if (metaPixelId) {
      const fbq = function () {
        fbq['callMethod'] ? (fbq['callMethod'] as Function).apply(fbq, arguments) : (fbq['queue'] as unknown[]).push(arguments);
      } as Tracker;
      Object.assign(fbq, { push: fbq, loaded: true, version: '2.0', queue: [] });
      win.fbq = win._fbq = fbq;
      fbq('init', metaPixelId);
    }

    const load = () => {
      if (gaMeasurementId) this.addScript(`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`);
      if (metaPixelId) this.addScript('https://connect.facebook.net/en_US/fbevents.js');
    };
    if ('requestIdleCallback' in win) win.requestIdleCallback(load, { timeout: 4000 });
    else setTimeout(load, 2000);

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      win.gtag?.('event', 'page_view', {
        page_location: win.location.href,
        page_title: this.document.title,
      });
      win.fbq?.('track', 'PageView');
    });
  }

  private addScript(src: string) {
    const script = this.document.createElement('script');
    script.async = true;
    script.src = src;
    this.document.head.appendChild(script);
  }
}
