import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  DOCUMENT
} from '@angular/core';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SURFACE_COLOR,
  PRIMARY_COLORS,
  PrimaryColor,
  SURFACE_COLORS,
  SurfaceColor,
} from '../themes/palettes';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'dark-mode';
const DARK_CLASS = 'app-dark';
const PRIMARY_STORAGE_KEY = 'primary-color';
const SURFACE_STORAGE_KEY = 'surface-color';

// Light / dark mode (the app-dark class on <html>) and the primary / surface palettes
// (data-primary / data-surface on <html>, read by themes/colors.scss).
// The stored values (no key = follow the system / the default palette) are also read by the
// inline script in index.html, which applies them before first paint
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private systemDark = signal(false);

  mode = signal<ThemeMode>(this.initialMode());
  primary = signal<PrimaryColor>(
    this.initialPalette(PRIMARY_STORAGE_KEY, PRIMARY_COLORS, DEFAULT_PRIMARY_COLOR),
  );
  surface = signal<SurfaceColor>(
    this.initialPalette(SURFACE_STORAGE_KEY, SURFACE_COLORS, DEFAULT_SURFACE_COLOR),
  );
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

    effect(() =>
      this.applyPalette('primary', this.primary(), DEFAULT_PRIMARY_COLOR, PRIMARY_STORAGE_KEY),
    );
    effect(() =>
      this.applyPalette('surface', this.surface(), DEFAULT_SURFACE_COLOR, SURFACE_STORAGE_KEY),
    );
  }

  setPrimary(color: PrimaryColor) {
    this.primary.set(color);
  }

  setSurface(color: SurfaceColor) {
    this.surface.set(color);
  }

  setMode(mode: ThemeMode) {
    this.mode.set(mode);
  }

  toggle() {
    this.mode.set(this.isDark() ? 'light' : 'dark');
  }

  // The default palette is the one without attribute (and without stored key)
  private applyPalette(
    name: 'primary' | 'surface',
    color: string,
    defaultColor: string,
    storageKey: string,
  ) {
    const root = this.document.documentElement;
    if (color === defaultColor) root.removeAttribute(`data-${name}`);
    else root.setAttribute(`data-${name}`, color);
    if (!this.isBrowser) return;
    try {
      if (color === defaultColor) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, color);
    } catch {}
  }

  private initialMode(): ThemeMode {
    if (!this.isBrowser) return 'system';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'true' ? 'dark' : 'light';
    } catch {}
    return 'system';
  }

  private initialPalette<T extends string>(
    storageKey: string,
    colors: readonly T[],
    defaultColor: T,
  ): T {
    if (!this.isBrowser) return defaultColor;
    try {
      const stored = localStorage.getItem(storageKey);
      if (colors.includes(stored as T)) return stored as T;
    } catch {}
    return defaultColor;
  }
}
