import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

// soft: tinted · primary: solid · neutral: muted fill · outlined: surface + border
// success/info/warning/danger/help: tinted statuses
export type IconVariant =
  | 'soft'
  | 'primary'
  | 'neutral'
  | 'outlined'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'help';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

// Every non clickable icon shown inside a square (or round) container of the app (buttons keep their own styles).
// Colors can be tuned per use with --icon-tone, --icon-color, --icon-background and --icon-border-color.
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClass()', 'aria-hidden': 'true' },
  template: `
    @if (icon()) {
      <i [class]="icon()"></i>
    }
    @if (label() !== '') {
      <span class="icon-label">{{ label() }}</span>
    }
    <ng-content />
  `,
  styles: `
    :host {
      --_tone: var(--icon-tone, var(--sp-primary-500));
      --_bg: color-mix(in srgb, var(--_tone) 14%, transparent);
      --_fg: var(--_tone);
      --_border: transparent;
      --_box: 40px;
      --_font-size: 16px;

      position: relative;
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      box-sizing: border-box;
      width: var(--_box);
      height: var(--_box);
      font-size: var(--_font-size);
      color: var(--icon-color, var(--_fg));
      background: var(--icon-background, var(--_bg));
      border: 1px solid var(--icon-border-color, var(--_border));
      border-radius: var(--icon-radius);
    }

    i {
      font-size: inherit;
    }

    .icon-label {
      font-size: inherit;
      font-weight: 800;
      line-height: 1;
    }

    /* Sizes */
    :host(.icon-xs) {
      --_box: 26px;
      --_font-size: 12px;
    }
    :host(.icon-sm) {
      --_box: 32px;
      --_font-size: 14px;
    }
    :host(.icon-lg) {
      --_box: 48px;
      --_font-size: 20px;
    }
    :host(.icon-xl) {
      --_box: 56px;
      --_font-size: 24px;
    }
    :host(.icon-xxl) {
      --_box: 88px;
      --_font-size: 34px;
    }

    :host(.icon-rounded) {
      border-radius: 50%;
    }

    /* Variants */
    :host(.icon-primary) {
      --_bg: var(--_tone);
      /* Stays light in both schemes, slightly tinted by the tone */
      --_fg: color-mix(in srgb, #fff 88%, var(--_tone));
    }
    :host(.icon-neutral) {
      --_bg: var(--sp-surface-100);
      --_fg: var(--sp-primary-600);
    }
    :host(.icon-outlined) {
      --_bg: var(--sp-surface-0);
      --_border: var(--sp-surface-200);
    }
    :host(.icon-success) {
      --_tone: var(--icon-tone, var(--sp-green-500));
    }
    :host(.icon-info) {
      --_tone: var(--icon-tone, var(--sp-blue-500));
    }
    :host(.icon-warning) {
      --_tone: var(--icon-tone, var(--sp-amber-500));
    }
    :host(.icon-danger) {
      --_tone: var(--icon-tone, var(--sp-red-500));
    }
    :host(.icon-help) {
      --_tone: var(--icon-tone, var(--sp-indigo-500));
    }
  `,
})
export class IconComponent {
  // Icon classes, e.g. "sp-icon sp-star" (or "sp-icon sp-star-fill" for PrimeIcons)
  readonly icon = input('');
  // Short text shown in the box (step number, initials...), instead of or next to the icon
  readonly label = input<string | number>('');
  readonly variant = input<IconVariant>('soft');
  readonly size = input<IconSize>('md');
  // Circle instead of a rounded square
  readonly rounded = input(false, { transform: booleanAttribute });

  protected readonly hostClass = computed(() =>
    [
      'icon',
      `icon-${this.variant()}`,
      `icon-${this.size()}`,
      this.rounded() ? 'icon-rounded' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
