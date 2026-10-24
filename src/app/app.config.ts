import {
  APP_INITIALIZER,
  ApplicationConfig,
  PLATFORM_ID,
  provideZoneChangeDetection,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  MissingTranslationHandler,
  provideTranslateService,
  TranslateLoader,
} from '@ngx-translate/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { provideAnimations } from '@angular/platform-browser/animations';

import { AppPreset } from './themes/preset';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { authInterceptor } from './services/auth/auth.interceptor';
import {
  BundledTranslateLoader,
  DEFAULT_LANGUAGE,
  LanguageService,
  TemplateColorFallback,
} from './services/language.service';
import { TemplatesService } from './services/templates/templates.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
      })
    ),
    provideClientHydration(),
    // Not the async version: PrimeNG dialogs miss their first open while it loads
    provideAnimations(),
    providePrimeNG({
      theme: {
        preset: AppPreset,
        options: {
          darkModeSelector: '.app-dark',
        },
      },
    }),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      withInterceptorsFromDi(),
    ),
    provideTranslateService({
      defaultLanguage: DEFAULT_LANGUAGE,
      loader: { provide: TranslateLoader, useClass: BundledTranslateLoader },
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useClass: TemplateColorFallback,
      },
    }),
    // Picks the language before the first render
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [LanguageService],
      useFactory: (language: LanguageService) => () => language.init(),
    },
    // Starts fetching the templates without holding the first render: pages read them
    // from a signal and update once they're there. Browser only: the server has no api
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [TemplatesService, PLATFORM_ID],
      useFactory: (templates: TemplatesService, platformId: object) => () => {
        if (isPlatformBrowser(platformId)) templates.load().subscribe();
      },
    },
  ],
};
