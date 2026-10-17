import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * Aura + app-specific semantic tokens.
 * Every key is emitted as a CSS variable, e.g. page.background -> --p-page-background,
 * and switches automatically between the light and dark values.
 * In dark mode the primary palette is reversed (50 <-> 950, 100 <-> 900...), so --p-primary-50 is the darkest shade.
 * Inside the dark scheme {primary.N} therefore resolves to the reversed shade (e.g. {primary.600} = emerald.400).
 */
export const AppPreset = definePreset(Aura, {
  semantic: {
    colorScheme: {
      light: {
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
          background:
            'linear-gradient(270deg, {primary.50} 6.75%, {primary.100} 98.85%)',
          reverse:
            'linear-gradient(270deg, {primary.100} 6.75%, {primary.50} 98.85%)',
        },
        card: {
          success: { background: '{primary.400}' },
          pink: { background: '{pink.100}' },
        },
      },
      dark: {
        primary: {
          50: '{emerald.950}',
          100: '{emerald.900}',
          200: '{emerald.800}',
          300: '{emerald.700}',
          400: '{emerald.600}',
          500: '{emerald.500}',
          600: '{emerald.400}',
          700: '{emerald.300}',
          800: '{emerald.200}',
          900: '{emerald.100}',
          950: '{emerald.50}',
          // Aura dark defaults (400 / 300 / 200), expressed on the reversed scale
          color: '{primary.600}',
          hoverColor: '{primary.700}',
          activeColor: '{primary.800}',
        },
        highlight: {
          background: 'color-mix(in srgb, {primary.600}, transparent 84%)',
          focusBackground: 'color-mix(in srgb, {primary.600}, transparent 76%)',
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
          background: 'color-mix(in srgb, {primary.600}, transparent 84%)',
          text: '{primary.700}',
        },
        gradient: {
          background:
            'linear-gradient(270deg, color-mix(in srgb, {primary.600}, transparent 90%) 6.75%, color-mix(in srgb, {primary.600}, transparent 80%) 98.85%)',
          reverse:
            'linear-gradient(270deg, color-mix(in srgb, {primary.600}, transparent 80%) 6.75%, color-mix(in srgb, {primary.600}, transparent 90%) 98.85%)',
        },
        card: {
          success: { background: '{primary.400}' },
          pink: {
            background: 'color-mix(in srgb, {pink.400}, transparent 80%)',
          },
        },
      },
    },
  },
});
