import { definePreset, type Preset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Primary and surface colors the user can pick from the header appearance menu (Aura primitive palettes)
export const PRIMARY_COLORS = [
  'emerald',
  'blue',
  'violet',
  'orange',
  'rose',
] as const;
export type PrimaryColor = (typeof PRIMARY_COLORS)[number];
export const DEFAULT_PRIMARY_COLOR: PrimaryColor = 'emerald';

export const SURFACE_COLORS = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'soho',
  'viva',
  'ocean',
  'sand',
  'navy',
  'forest',
  'plum',
  'blush',
] as const;
export type SurfaceColor = (typeof SURFACE_COLORS)[number];
export const DEFAULT_SURFACE_COLOR: SurfaceColor = 'zinc';

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// {color.50} ... {color.950}
function paletteScale(color: string) {
  return Object.fromEntries(
    SHADES.map((shade) => [shade, `{${color}.${shade}}`]),
  );
}

// Aura surfaces also have a pure white 0 shade
function surfaceScale(color: SurfaceColor) {
  return { 0: '#ffffff', ...paletteScale(color) };
}

// Swaps the primary palette, --p-app-primary-* of both schemes follows it
export function primaryPalettePreset(color: PrimaryColor) {
  return { semantic: { primary: paletteScale(color) } };
}

// Swaps the surface palette of both schemes, --p-app-surface-* follows it
export function surfacePalettePreset(color: SurfaceColor) {
  return {
    semantic: {
      colorScheme: {
        light: { surface: surfaceScale(color) },
        dark: { surface: surfaceScale(color) },
      },
    },
  };
}

/**
 * Aura + the two app palettes, the only color tokens the app styles use:
 * - --p-app-primary-50 ... --p-app-primary-950: the selected primary color
 * - --p-app-surface-0 ... --p-app-surface-950: backgrounds, texts, borders and hovers
 * Both are reversed in dark mode (50 <-> 950, 100 <-> 900...), so a shade keeps the same
 * contrast role in both schemes: --p-app-surface-0 is the lightest in light mode and the darkest in dark mode.
 * PrimeNG's primary (button, focus...) colors are mapped on them too.
 * Both palettes are switchable at runtime (see ThemeService.setPrimary / setSurface).
 * Unlike Aura (slate in light, zinc in dark), both schemes share the same surface palette.
 */
// Typed as a plain Preset: custom token groups (soho, app...) are valid at runtime but unknown to Aura's typings
const appTokens: Preset = {
  // Extra surface palettes (from the PrimeNG theme configurator), emitted as --p-soho-50 ... like Aura's own
  primitive: {
    soho: {
      50: '#ececec',
      100: '#dedfdf',
      200: '#c4c4c6',
      300: '#adaeb0',
      400: '#97979b',
      500: '#7f8084',
      600: '#6a6b70',
      700: '#55565b',
      800: '#3f4046',
      900: '#2c2c34',
      950: '#16161d',
    },
    viva: {
      50: '#f3f3f3',
      100: '#e7e7e8',
      200: '#cfd0d0',
      300: '#b7b8b9',
      400: '#9fa1a1',
      500: '#87898a',
      600: '#6e7173',
      700: '#565a5b',
      800: '#3e4244',
      900: '#262b2c',
      950: '#0e1315',
    },
    ocean: {
      50: '#fbfcfc',
      100: '#f7f9f8',
      200: '#eff3f2',
      300: '#dadedd',
      400: '#b1b7b6',
      500: '#828787',
      600: '#5f7274',
      700: '#415b61',
      800: '#29444e',
      900: '#183240',
      950: '#0c1920',
    },
    // Tinted surfaces, clearly apart from the grays above
    sand: {
      50: '#faf6ef',
      100: '#f3ecdf',
      200: '#e6d8c0',
      300: '#d3be9c',
      400: '#bba077',
      500: '#a0845c',
      600: '#846a49',
      700: '#67533b',
      800: '#4a3c2c',
      900: '#30271e',
      950: '#1a1510',
    },
    navy: {
      50: '#f0f4fa',
      100: '#e1e9f5',
      200: '#c5d3e8',
      300: '#a0b4d4',
      400: '#7790ba',
      500: '#56709e',
      600: '#435a84',
      700: '#36486b',
      800: '#283654',
      900: '#1a2540',
      950: '#0d1526',
    },
    forest: {
      50: '#f1f7f2',
      100: '#e2eee4',
      200: '#c6dcca',
      300: '#a1c2a8',
      400: '#78a282',
      500: '#5a8464',
      600: '#476a50',
      700: '#385440',
      800: '#2a3f30',
      900: '#1c2b21',
      950: '#0e1711',
    },
    plum: {
      50: '#f7f2f9',
      100: '#eee4f3',
      200: '#dcc8e6',
      300: '#c3a4d3',
      400: '#a57dba',
      500: '#87609c',
      600: '#6d4c80',
      700: '#563c65',
      800: '#3f2c4a',
      900: '#2a1d32',
      950: '#170f1c',
    },
    blush: {
      50: '#fbf2f3',
      100: '#f6e4e6',
      200: '#ebc8cd',
      300: '#dba3ab',
      400: '#c47b86',
      500: '#a65e6a',
      600: '#884b56',
      700: '#6b3c45',
      800: '#4e2d33',
      900: '#341e22',
      950: '#1c1012',
    },
  },
  semantic: {
    primary: paletteScale(DEFAULT_PRIMARY_COLOR),
    colorScheme: {
      light: {
        surface: surfaceScale(DEFAULT_SURFACE_COLOR),
        primary: {
          color: '{app.primary.500}',
          contrastColor: '{app.surface.0}',
          hoverColor: '{app.primary.600}',
          activeColor: '{app.primary.700}',
        },
        app: {
          primary: {
            50: '{primary.50}',
            100: '{primary.100}',
            200: '{primary.200}',
            300: '{primary.300}',
            400: '{primary.400}',
            500: '{primary.500}',
            600: '{primary.600}',
            700: '{primary.700}',
            800: '{primary.800}',
            900: '{primary.900}',
            950: '{primary.950}',
          },
          // Same logic as the dark scheme: 0 follows the palette (its lightest shade) instead of the fixed white
          surface: {
            0: '{surface.50}',
            50: '{surface.50}',
            100: '{surface.100}',
            200: '{surface.200}',
            300: '{surface.300}',
            400: '{surface.400}',
            500: '{surface.500}',
            600: '{surface.600}',
            700: '{surface.700}',
            800: '{surface.800}',
            900: '{surface.900}',
            950: '{surface.950}',
          },
        },
      },
      dark: {
        surface: surfaceScale(DEFAULT_SURFACE_COLOR),
        primary: {
          color: '{app.primary.500}',
          contrastColor: '{app.surface.0}',
          hoverColor: '{app.primary.600}',
          activeColor: '{app.primary.700}',
        },
        // Reversed (50 <-> 950...), there is no shade darker than 950 so 0 also maps to it
        app: {
          primary: {
            50: '{primary.950}',
            100: '{primary.900}',
            200: '{primary.800}',
            300: '{primary.700}',
            400: '{primary.600}',
            500: '{primary.500}',
            600: '{primary.400}',
            700: '{primary.300}',
            800: '{primary.200}',
            900: '{primary.100}',
            950: '{primary.50}',
          },
          surface: {
            0: '{surface.950}',
            50: '{surface.950}',
            100: '{surface.900}',
            200: '{surface.800}',
            300: '{surface.700}',
            400: '{surface.600}',
            500: '{surface.500}',
            600: '{surface.400}',
            700: '{surface.300}',
            800: '{surface.200}',
            900: '{surface.100}',
            950: '{surface.50}',
          },
        },
      },
    },
  },
};

export const AppPreset = definePreset(Aura, appTokens);
