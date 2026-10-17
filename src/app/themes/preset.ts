import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * Aura + app-specific semantic tokens.
 * Every key under `app` is emitted as a CSS variable, e.g. app.page.background -> --p-app-page-background,
 * and switches automatically between the light and dark values.
 * app.primary.* is the primary palette reversed in dark mode (50 <-> 950, 100 <-> 900...), e.g. --p-app-primary-50.
 */
export const AppPreset = definePreset(Aura, {
  semantic: {
    colorScheme: {
      light: {
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
          page: { background: '{surface.50}' },
          text: {
            strong: '{surface.950}',
            description: '{surface.700}',
            secondary: '{surface.600}',
            subtle: '{surface.400}',
          },
          border: { strong: '{surface.300}' },
          muted: { background: '{surface.200}' },
          accent: {
            background: '{primary.50}',
            text: '{primary.600}',
          },
          gradient: {
            background: 'linear-gradient(270deg, {primary.50} 6.75%, {primary.100} 98.85%)',
            reverse: 'linear-gradient(270deg, {primary.100} 6.75%, {primary.50} 98.85%)',
          },
          card: {
            success: { background: '{primary.400}' },
            pink: { background: '{pink.100}' },
          },
        },
      },
      dark: {
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
          page: { background: '{surface.950}' },
          text: {
            strong: '{surface.0}',
            description: '{surface.200}',
            secondary: '{surface.300}',
            subtle: '{surface.500}',
          },
          border: { strong: '{surface.600}' },
          muted: { background: '{surface.700}' },
          accent: {
            background: 'color-mix(in srgb, {primary.400}, transparent 84%)',
            text: '{primary.300}',
          },
          gradient: {
            background:
              'linear-gradient(270deg, color-mix(in srgb, {primary.400}, transparent 90%) 6.75%, color-mix(in srgb, {primary.400}, transparent 80%) 98.85%)',
            reverse:
              'linear-gradient(270deg, color-mix(in srgb, {primary.400}, transparent 80%) 6.75%, color-mix(in srgb, {primary.400}, transparent 90%) 98.85%)',
          },
          card: {
            success: { background: '{primary.600}' },
            pink: { background: 'color-mix(in srgb, {pink.400}, transparent 80%)' },
          },
        },
      },
    },
  },
});
