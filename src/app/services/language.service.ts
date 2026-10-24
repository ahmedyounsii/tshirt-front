import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import {
  MissingTranslationHandler,
  MissingTranslationHandlerParams,
  TranslateLoader,
  TranslateService,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';

export type Language = 'en' | 'fr';

export const LANGUAGES: Language[] = ['en', 'fr'];
// French: the language of the shop's customers (Tunisia) and of what search engines index
export const DEFAULT_LANGUAGE: Language = 'fr';

const STORAGE_KEY = 'language';
const TRANSLATIONS: Record<Language, object> = { en, fr };

// Translations are bundled instead of fetched: they are there during SSR and
// on the first browser render, so raw keys never flash on screen
export class BundledTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<object> {
    return of(TRANSLATIONS[lang as Language] ?? TRANSLATIONS[DEFAULT_LANGUAGE]);
  }
}

const COLOR_PREFIX = 'templates.colors.';

// Colors are named by the admins when adding a template: a name without a translation
// is shown as typed ("navy blue" -> "Navy blue") instead of its key
export class TemplateColorFallback implements MissingTranslationHandler {
  handle({ key }: MissingTranslationHandlerParams): string {
    if (!key.startsWith(COLOR_PREFIX)) return key;
    const name = key.slice(COLOR_PREFIX.length);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}

// Current UI language: the stored choice, else English for English browsers, else French
@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  current = signal<Language>(DEFAULT_LANGUAGE);

  // Called once at startup (see app.config.ts)
  init() {
    this.translate.addLangs(LANGUAGES);
    this.translate.setDefaultLang(DEFAULT_LANGUAGE);
    this.use(this.initialLanguage(), false);
  }

  use(lang: Language, persist = true) {
    // Translations load synchronously: instant() already uses the new language when current changes
    this.translate.use(lang);
    this.current.set(lang);
    this.document.documentElement.lang = lang;
    if (!persist || !this.isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }

  private initialLanguage(): Language {
    if (!this.isBrowser) return DEFAULT_LANGUAGE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (LANGUAGES.includes(stored as Language)) return stored as Language;
    } catch {}
    return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';
  }
}
