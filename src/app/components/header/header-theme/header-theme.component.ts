import {
  Component,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { PopoverComponent } from '../../popover/popover.component';
import { ThemeMode, ThemeService } from '../../../services/theme.service';
import { PRIMARY_COLORS, SURFACE_COLORS } from '../../../themes/palettes';
import {
  BottomDrawerComponent,
  injectIsMobile,
} from '../../bottom-drawer/bottom-drawer.component';
import {
  SelectButtonComponent,
  SelectButtonOption,
} from '../../selectbutton/selectbutton.component';

// Appearance menu of the header: light / dark / system mode, the primary and the surface colors.
// The popover is appended to body, so its styles can't be encapsulated
// On mobile the same panel opens in a bottom sheet instead of the popover
@Component({
    selector: 'app-header-theme',
    imports: [
        NgTemplateOutlet,
        TranslatePipe,
        BottomDrawerComponent,
        PopoverComponent,
        SelectButtonComponent,
    ],
    encapsulation: ViewEncapsulation.None,
    template: `
    <button
      type="button"
      class="app-btn app-btn-sm app-btn-secondary app-btn-text app-btn-icon-only"
      (click)="toggle($event)"
      [attr.aria-label]="'theme.menu' | translate"
    >
      <i class="pi pi-palette" aria-hidden="true"></i>
    </button>
    <!-- Mobile: a bottom sheet; desktop: a popover. Both share the panel template -->
    @if (isMobile()) {
      @if (sheetOpen()) {
        <app-bottom-drawer
          class="theme-sheet"
          [ariaLabel]="'theme.menu' | translate"
          (doClose)="sheetOpen.set(false)"
        >
          <ng-container [ngTemplateOutlet]="themePanel" />
        </app-bottom-drawer>
      }
    } @else {
      <app-popover class="theme-popover">
        <ng-container [ngTemplateOutlet]="themePanel" />
      </app-popover>
    }
    <ng-template #themePanel>
      <div class="theme-panel">
        <div class="theme-section">
          <span class="theme-section-title">{{
            'theme.mode' | translate
          }}</span>
          <app-selectbutton
            layout="vertical"
            [fluid]="true"
            [options]="modes"
            [value]="themeService.mode()"
            [ariaLabel]="'theme.mode' | translate"
            (valueChange)="themeService.setMode($event)"
          />
        </div>

        <div
          class="theme-section"
          role="group"
          [attr.aria-label]="'theme.color' | translate"
        >
          <span class="theme-section-title">{{
            'theme.color' | translate
          }}</span>
          <div class="theme-swatches">
            @for (color of primaryColors; track color) {
              <button
                type="button"
                class="theme-swatch"
                [style.--swatch-color]="'var(--sp-' + color + '-500)'"
                [attr.aria-label]="'theme.colors.' + color | translate"
                [title]="'theme.colors.' + color | translate"
                [attr.aria-pressed]="themeService.primary() === color"
                (click)="themeService.setPrimary(color)"
              >
                @if (themeService.primary() === color) {
                  <i class="pi pi-check"></i>
                }
              </button>
            }
          </div>
        </div>

        <div
          class="theme-section"
          role="group"
          [attr.aria-label]="'theme.surface' | translate"
        >
          <span class="theme-section-title">{{
            'theme.surface' | translate
          }}</span>
          <div class="theme-swatches">
            @for (color of surfaceColors; track color) {
              <button
                type="button"
                class="theme-swatch"
                [style.--swatch-color]="'var(--sp-' + color + '-500)'"
                [attr.aria-label]="'theme.surfaces.' + color | translate"
                [title]="'theme.surfaces.' + color | translate"
                [attr.aria-pressed]="themeService.surface() === color"
                (click)="themeService.setSurface(color)"
              >
                @if (themeService.surface() === color) {
                  <i class="pi pi-check"></i>
                }
              </button>
            }
          </div>
        </div>
      </div>
    </ng-template>
  `,
    styles: `
    app-header-theme {
      display: flex;
      align-items: center;
    }

    .theme-popover {
      --popover-padding: 0;
    }

    .theme-panel {
      color: var(--sp-surface-700);
      min-width: 250px;
    }

    .theme-section {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem;
    }

    .theme-section + .theme-section {
      border-top: 1px solid var(--sp-surface-200);
    }

    .theme-section-title {
      font-size: 0.75rem;
      margin-bottom: 0.25rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--sp-surface-600);
    }

    .theme-swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      max-width: 15rem;
      padding: 0.25rem;
    }

    .theme-swatch {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.6rem;
      height: 1.6rem;
      padding: 0;
      border: none;
      border-radius: var(--button-radius);
      background: var(--swatch-color);
      color: #fff;
      cursor: pointer;
      transition:
        box-shadow 0.15s,
        transform 0.15s;
    }

    .theme-swatch i {
      font-size: 0.7rem;
      font-weight: 700;
    }

    .theme-swatch:hover {
      transform: scale(1.1);
    }

    .theme-swatch:focus-visible,
    .theme-swatch[aria-pressed='true'] {
      outline: none;
      box-shadow:
        0 0 0 2px var(--sp-surface-0),
        0 0 0 4px var(--swatch-color);
    }

    /* Mobile bottom sheet: it already pads its sides */
    .theme-sheet .theme-section {
      padding-inline: 0;
    }
  `
})
export class HeaderThemeComponent {
  themeService = inject(ThemeService);
  readonly primaryColors = PRIMARY_COLORS;
  readonly surfaceColors = SURFACE_COLORS;
  readonly modes: SelectButtonOption<ThemeMode>[] = [
    { value: 'light', label: 'theme.modes.light', icon: 'pi pi-sun' },
    { value: 'dark', label: 'theme.modes.dark', icon: 'pi pi-moon' },
    { value: 'system', label: 'theme.modes.system', icon: 'pi pi-desktop' },
  ];

  readonly isMobile = injectIsMobile();
  readonly sheetOpen = signal(false);
  private popover = viewChild(PopoverComponent);
  private sheet = viewChild(BottomDrawerComponent);

  toggle(event: Event) {
    if (!this.isMobile()) {
      this.popover()?.toggle(event);
    } else if (this.sheetOpen()) {
      this.sheet()?.close();
    } else {
      this.sheetOpen.set(true);
    }
  }
}
