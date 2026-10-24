import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { updatePreset } from '@primeng/themes';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SURFACE_COLOR,
  PRIMARY_COLORS,
  PrimaryColor,
  primaryPalettePreset,
  SHADES,
  SURFACE_COLORS,
  SurfaceColor,
  surfacePalettePreset,
} from '../themes/preset';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'dark-mode';
const DARK_CLASS = 'app-dark';
const PRIMARY_STORAGE_KEY = 'primary-color';
const SURFACE_STORAGE_KEY = 'surface-color';

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

    // The server always renders the default palettes
    if (this.isBrowser && this.primary() !== DEFAULT_PRIMARY_COLOR) {
      updatePreset(primaryPalettePreset(this.primary()));
    }
    if (this.isBrowser && this.surface() !== DEFAULT_SURFACE_COLOR) {
      updatePreset(surfacePalettePreset(this.surface()));
    }
  }

  setPrimary(color: PrimaryColor) {
    if (color === this.primary()) return;
    this.primary.set(color);
    updatePreset(primaryPalettePreset(color));
    this.applyPalette('primary', color, DEFAULT_PRIMARY_COLOR, PRIMARY_STORAGE_KEY);
  }

  setSurface(color: SurfaceColor) {
    if (color === this.surface()) return;
    this.surface.set(color);
    updatePreset(surfacePalettePreset(color));
    this.applyPalette('surface', color, DEFAULT_SURFACE_COLOR, SURFACE_STORAGE_KEY);
  }

  setMode(mode: ThemeMode) {
    this.mode.set(mode);
  }

  toggle() {
    this.mode.set(this.isDark() ? 'light' : 'dark');
  }

  // The inline script in index.html sets --p-primary-* / --p-surface-* on <html> before first paint
  // (no default palette flash before updatePreset runs). Inline styles win over the preset, so keep
  // them in sync, then save the choice (no key = the default palette)
  private applyPalette(
    name: 'primary' | 'surface',
    color: string,
    defaultColor: string,
    storageKey: string,
  ) {
    const style = this.document.documentElement.style;
    for (const shade of SHADES) {
      if (color === defaultColor) style.removeProperty(`--p-${name}-${shade}`);
      else style.setProperty(`--p-${name}-${shade}`, `var(--p-${color}-${shade})`);
    }
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
