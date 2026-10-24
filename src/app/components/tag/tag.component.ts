import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

// neutral: muted fill · outlined: surface + border · primary: solid · soft: tinted · accent: theme accent
// contrast: dark fill · glass: translucent over images · success/info/warning/danger/help: tinted statuses
export type TagVariant =
  | 'neutral'
  | 'outlined'
  | 'primary'
  | 'soft'
  | 'accent'
  | 'contrast'
  | 'glass'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'help';

export type TagSize = 'xs' | 'sm' | 'md' | 'lg';

// Every non clickable tag, badge and counter of the app (buttons keep their own styles).
// Colors can be tuned per use with --tag-tone (primary/soft), --tag-color, --tag-background, --tag-border-color
// and --tag-icon-color.
@Component({
  selector: 'app-tag',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClass()' },
  template: `
    @if (icon()) {
      <i [class]="icon()" aria-hidden="true"></i>
    }
    <ng-content />
  `,
  styles: `
    :host {
      --_tone: var(--tag-tone, var(--p-app-primary-500));
      --_bg: var(--p-app-surface-100);
      --_fg: var(--p-app-surface-700);
      --_border: transparent;
      --_font-size: 12px;
      --_padding: 3px 8px;
      --_gap: 5px;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      gap: var(--_gap);
      box-sizing: border-box;
      padding: var(--_padding);
      font: inherit;
      font-size: var(--_font-size);
      font-weight: 600;
      line-height: 1.35;
      white-space: nowrap;
      vertical-align: middle;
      color: var(--tag-color, var(--_fg));
      background: var(--tag-background, var(--_bg));
      border: 1px solid var(--tag-border-color, var(--_border));
      border-radius: var(--tags-radius);
    }

    i {
      font-size: calc(var(--_font-size) - 1px);
      color: var(--tag-icon-color, currentColor);
    }

    /* Sizes */
    :host(.tag-xs) {
      --_font-size: 11px;
      --_padding: 1px 6px;
      --_gap: 4px;
      min-width: 20px;
      font-weight: 700;
    }
    :host(.tag-md) {
      --_padding: 5px 12px;
      --_gap: 6px;
    }
    :host(.tag-lg) {
      --_font-size: 14px;
      --_padding: 6px 12px;
      --_gap: 8px;
    }
    :host(.tag-icon-only) {
      aspect-ratio: 1;
      padding: 0;
      min-width: calc(var(--_font-size) * 1.35 + 6px);
    }

    :host(.tag-uppercase) {
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    /* Variants */
    :host(.tag-outlined) {
      --_bg: var(--p-app-surface-0);
      --_border: var(--p-app-surface-200);
    }
    :host(.tag-primary) {
      --_bg: var(--_tone);
      --_fg: var(--p-app-surface-0);
      --_border: var(--_tone);
    }
    :host(.tag-soft),
    :host(.tag-success),
    :host(.tag-info),
    :host(.tag-warning),
    :host(.tag-danger),
    :host(.tag-help) {
      --_bg: color-mix(in srgb, var(--_tone) 14%, transparent);
      --_fg: color-mix(in srgb, var(--_tone) 85%, var(--p-app-surface-700));
    }
    :host(.tag-success) {
      --_tone: var(--tag-tone, var(--p-green-500));
    }
    :host(.tag-info) {
      --_tone: var(--tag-tone, var(--p-blue-500));
    }
    :host(.tag-warning) {
      --_tone: var(--tag-tone, var(--p-amber-500));
    }
    :host(.tag-danger) {
      --_tone: var(--tag-tone, var(--p-red-500));
    }
    :host(.tag-help) {
      --_tone: var(--tag-tone, var(--p-indigo-500));
    }
    :host(.tag-accent) {
      --_bg: var(--p-app-primary-50);
      --_fg: var(--p-app-primary-600);
    }
    :host(.tag-contrast) {
      --_bg: var(--p-app-surface-950);
      --_fg: var(--p-app-surface-0);
    }
    :host(.tag-glass) {
      --_bg: rgba(255, 255, 255, 0.16);
      --_fg: currentColor;
      backdrop-filter: blur(6px);
    }
  `,
})
export class TagComponent {
  readonly variant = input<TagVariant>('neutral');
  readonly size = input<TagSize>('sm');
  // PrimeIcons classes, e.g. "pi pi-star-fill"
  readonly icon = input('');
  readonly uppercase = input(false, { transform: booleanAttribute });
  // Square holding the icon only (no text)
  readonly iconOnly = input(false, { transform: booleanAttribute });

  protected readonly hostClass = computed(() =>
    [
      'tag',
      `tag-${this.variant()}`,
      `tag-${this.size()}`,
      this.uppercase() ? 'tag-uppercase' : '',
      this.iconOnly() ? 'tag-icon-only' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
