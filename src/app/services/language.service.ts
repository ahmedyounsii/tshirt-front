import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';

export type Language = 'en' | 'fr';

export const LANGUAGES: Language[] = ['en', 'fr'];
export const DEFAULT_LANGUAGE: Language = 'en';

const STORAGE_KEY = 'language';
const TRANSLATIONS: Record<Language, object> = { en, fr };

// Translations are bundled instead of fetched: they are there during SSR and
// on the first browser render, so raw keys never flash on screen
export class BundledTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<object> {
    return of(TRANSLATIONS[lang as Language] ?? TRANSLATIONS[DEFAULT_LANGUAGE]);
  }
}

// Current UI language: the stored choice, else the browser language, else English
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

  toggle() {
    this.use(this.current() === 'en' ? 'fr' : 'en');
  }

  private initialLanguage(): Language {
    if (!this.isBrowser) return DEFAULT_LANGUAGE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (LANGUAGES.includes(stored as Language)) return stored as Language;
    } catch {}
    return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  }
}
