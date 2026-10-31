// Primary and surface palettes the user can pick from the header appearance menu.
// Their colors are the --sp-<color>-* tokens of themes/colors.scss; the choice is applied as
// data-primary / data-surface on <html> (see ThemeService and the inline script of index.html).
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
