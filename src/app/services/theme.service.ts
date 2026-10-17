import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'dark-mode';
const DARK_CLASS = 'app-dark';

// The stored value stays 'true' / 'false' (no key = follow the system) so the
// inline script in index.html can apply the theme before first paint
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private systemDark = signal(false);

  mode = signal<ThemeMode>(this.initialMode());
  isDark = computed(() =>
    this.mode() === 'system' ? this.systemDark() : this.mode() === 'dark',
  );

  constructor() {
    if (this.isBrowser) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDark.set(media.matches);
      media.addEventListener('change', (event) =>
        this.systemDark.set(event.matches),
      );
    }

    effect(() => {
      this.document.documentElement.classList.toggle(DARK_CLASS, this.isDark());
    });

    effect(() => {
      const mode = this.mode();
      if (!this.isBrowser) return;
      try {
        if (mode === 'system') localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, String(mode === 'dark'));
      } catch {}
    });
  }

  setMode(mode: ThemeMode) {
    this.mode.set(mode);
  }

  toggle() {
    this.mode.set(this.isDark() ? 'light' : 'dark');
  }

  private initialMode(): ThemeMode {
    if (!this.isBrowser) return 'system';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'true' ? 'dark' : 'light';
    } catch {}
    return 'system';
  }
}
