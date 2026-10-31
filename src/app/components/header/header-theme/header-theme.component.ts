import {
  Component,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { ThemeMode, ThemeService } from '../../../services/theme.service';
import { PRIMARY_COLORS, SURFACE_COLORS } from '../../../themes/preset';
import {
  BottomDrawerComponent,
  injectIsMobile,
} from '../../bottom-drawer/bottom-drawer.component';

interface ModeOption {
  mode: ThemeMode;
  icon: string;
}

// Appearance menu of the header: light / dark / system mode, the primary and the surface colors.
// The popover is appended to body, so its styles can't be encapsulated
// On mobile the same panel opens in a bottom sheet instead of the popover
@Component({
    selector: 'app-header-theme',
    imports: [
        NgTemplateOutlet,
        TranslatePipe,
        BottomDrawerComponent,
        ButtonModule,
        PopoverModule,
    ],
    encapsulation: ViewEncapsulation.None,
    template: `
    <p-button
      size="small"
      icon="pi pi-palette"
      [text]="true"
      severity="secondary"
      [ariaLabel]="'theme.menu' | translate"
      (onClick)="toggle($event)"
    />
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
      <p-popover appendTo="body" styleClass="theme-popover">
        <ng-container [ngTemplateOutlet]="themePanel" />
      </p-popover>
    }
    <ng-template #themePanel>
      <div class="theme-panel">
        <div
          class="theme-section"
          role="group"
          [attr.aria-label]="'theme.mode' | translate"
        >
          <span class="theme-section-title">{{
            'theme.mode' | translate
          }}</span>
          <div class="theme-modes">
            @for (option of modes; track option.mode) {
              <button
                type="button"
                class="theme-mode"
                [attr.aria-pressed]="themeService.mode() === option.mode"
                (click)="themeService.setMode(option.mode)"
              >
                <i [class]="option.icon"></i>
                <span>{{ 'theme.modes.' + option.mode | translate }}</span>
              </button>
            }
          </div>
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
                [style.--swatch-color]="'var(--p-' + color + '-500)'"
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
                [style.--swatch-color]="'var(--p-' + color + '-500)'"
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

    .theme-popover.p-popover {
      border-radius: var(--card-radius);
      overflow: hidden;
    }

    .theme-popover .p-popover-content {
      padding: 0;
    }

    .theme-panel {
      color: var(--p-app-surface-700);
      min-width: 250px;
    }

    .theme-section {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem;
    }

    .theme-section + .theme-section {
      border-top: 1px solid var(--p-app-surface-200);
    }

    .theme-section-title {
      font-size: 0.75rem;
      margin-bottom: 0.25rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--p-app-surface-600);
    }

    .theme-modes {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.25rem;
      padding: 0.25rem;
      border-radius: var(--button-radius);
      background: var(--p-app-surface-100);
    }

    .theme-mode {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      padding: 0.5rem;
      border: none;
      border-radius: var(--button-radius);
      background: none;
      color: var(--p-app-surface-500);
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s;
    }

    .theme-mode:hover,
    .theme-mode:focus-visible {
      outline: none;
      color: var(--p-app-surface-700);
    }

    .theme-mode[aria-pressed='true'] {
      background: var(--p-app-surface-0);
      color: var(--p-app-primary-500);
      font-weight: 600;
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
        0 0 0 2px var(--p-app-surface-0),
        0 0 0 4px var(--swatch-color);
    }

    /* Mobile bottom sheet: it already pads its sides, buttons get larger tap targets */
    .theme-sheet .theme-section {
      padding-inline: 0;
    }

    .theme-sheet .theme-mode {
      padding-block: 0.8rem;
    }
  `
})
export class HeaderThemeComponent {
  themeService = inject(ThemeService);
  readonly primaryColors = PRIMARY_COLORS;
  readonly surfaceColors = SURFACE_COLORS;
  readonly modes: ModeOption[] = [
    { mode: 'light', icon: 'pi pi-sun' },
    { mode: 'dark', icon: 'pi pi-moon' },
    { mode: 'system', icon: 'pi pi-desktop' },
  ];

  readonly isMobile = injectIsMobile();
  readonly sheetOpen = signal(false);
  private popover = viewChild(Popover);
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
