import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Popover, PopoverModule } from 'primeng/popover';
import { AuthService } from '../../../services/auth/auth.service';
import { MaintenanceService } from '../../../services/maintenance/maintenance.service';
import { OrdersService } from '../../../services/orders/orders.service';
import {
  AdminViewService,
  AppView,
} from '../../../services/admin-view/admin-view.service';
import {
  BottomDrawerComponent,
  injectIsMobile,
} from '../../bottom-drawer/bottom-drawer.component';

interface ViewOption {
  view: AppView;
  icon: string;
}

// Admins only: picks how the app is shown, the shop (user view) or the back office
// with its sidebar and dashboard (admin view). The badge counts the pending orders.
// The session lives in localStorage, so the server never renders it: ngSkipHydration
// makes the browser render this part from scratch instead of reusing the server markup
// The popover is appended to body, so its styles can't be encapsulated
// On mobile the same list opens in a bottom sheet instead of the popover
@Component({
    selector: 'app-header-view-switch',
    imports: [NgTemplateOutlet, TranslatePipe, BottomDrawerComponent, PopoverModule],
    host: { ngSkipHydration: 'true' },
    encapsulation: ViewEncapsulation.None,
    template: `
    @if (auth.isAdmin()) {
      <button
        type="button"
        class="view-trigger"
        [class.admin]="adminView.isAdminView()"
        [attr.aria-label]="'adminView.switch' | translate"
        aria-haspopup="dialog"
        (click)="toggle($event)"
      >
        <i [class]="current().icon" aria-hidden="true"></i>
        <span class="view-trigger-label">{{
          'adminView.' + current().view + '.label' | translate
        }}</span>
        <i class="pi pi-chevron-down view-trigger-chevron" aria-hidden="true"></i>
        @if (pendingOrders(); as pending) {
          <span
            class="view-trigger-badge"
            [title]="'account.pendingOrders' | translate: { count: pending }"
          >
            {{ pending > 99 ? '99+' : pending }}
          </span>
        }
      </button>
      @if (isMobile()) {
        @if (sheetOpen()) {
          <app-bottom-drawer
            class="view-sheet"
            [ariaLabel]="'adminView.switch' | translate"
            (doClose)="sheetOpen.set(false)"
          >
            <ng-container [ngTemplateOutlet]="viewList" />
          </app-bottom-drawer>
        }
      } @else {
        <p-popover appendTo="body" styleClass="view-popover">
          <ng-container [ngTemplateOutlet]="viewList" />
        </p-popover>
      }
      <ng-template #viewList>
        <div
          class="view-list"
          role="group"
          [attr.aria-label]="'adminView.switch' | translate"
        >
          <span class="view-list-title">{{ 'adminView.switch' | translate }}</span>
          @for (option of options; track option.view) {
            <button
              type="button"
              class="view-option"
              [attr.aria-pressed]="adminView.view() === option.view"
              (click)="select(option.view)"
            >
              <span class="view-option-icon"><i [class]="option.icon"></i></span>
              <span class="view-option-text">
                <span class="view-option-name">{{
                  'adminView.' + option.view + '.label' | translate
                }}</span>
                <span class="view-option-hint">{{
                  'adminView.' + option.view + '.hint' | translate
                }}</span>
              </span>
              @if (adminView.view() === option.view) {
                <i class="pi pi-check view-option-check"></i>
              }
            </button>
          }
        </div>
      </ng-template>
    }
  `,
    styles: `
    app-header-view-switch {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .view-trigger {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 0 10px 0 12px;
      border: var(--global-border);
      border-radius: var(--button-radius);
      background: var(--p-app-surface-0);
      color: var(--p-app-surface-700);
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      transition:
        background 0.15s,
        border-color 0.15s,
        color 0.15s;
    }

    .view-trigger:hover {
      background: var(--p-app-surface-100);
    }

    .view-trigger:focus-visible {
      outline: 2px solid var(--p-app-primary-500);
      outline-offset: 2px;
    }

    .view-trigger.admin {
      border-color: color-mix(in srgb, var(--p-app-primary-500) 35%, transparent);
      background: color-mix(in srgb, var(--p-app-primary-500) 10%, transparent);
      color: var(--p-app-primary-600);
    }

    .view-trigger > i:first-child {
      font-size: 14px;
    }

    .view-trigger-chevron {
      font-size: 10px;
      opacity: 0.7;
    }

    .view-trigger-badge {
      position: absolute;
      top: -0.45rem;
      right: -0.45rem;
      min-width: 1.1rem;
      height: 1.1rem;
      padding: 0 0.3rem;
      border-radius: var(--tags-radius);
      border: 2px solid var(--p-app-surface-0);
      background: var(--p-red-500);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      line-height: calc(1.1rem - 4px);
      text-align: center;
      box-sizing: border-box;
      pointer-events: none;
    }

    .view-popover.p-popover {
      border-radius: var(--card-radius);
      overflow: hidden;
    }

    .view-popover .p-popover-content {
      padding: 0;
    }

    .view-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 290px;
      padding: 0.5rem;
    }

    .view-list-title {
      padding: 0.25rem 0.5rem 0.4rem;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--p-app-surface-500);
    }

    .view-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0.6rem;
      border: none;
      border-radius: var(--button-radius);
      background: none;
      color: var(--p-app-surface-700);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s;
    }

    .view-option:hover,
    .view-option:focus-visible {
      outline: none;
      background: var(--p-app-surface-100);
    }

    .view-option-icon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: var(--icon-radius);
      background: var(--p-app-surface-100);
      color: var(--p-app-surface-500);
    }

    .view-option[aria-pressed='true'] .view-option-icon {
      background: color-mix(in srgb, var(--p-app-primary-500) 14%, transparent);
      color: var(--p-app-primary-500);
    }

    .view-option-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .view-option-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--p-app-surface-900);
    }

    .view-option-hint {
      font-size: 0.75rem;
      color: var(--p-app-surface-500);
      line-height: 1.35;
    }

    .view-option-check {
      font-size: 0.75rem;
      color: var(--p-app-primary-500);
    }

    .view-sheet .view-list {
      width: auto;
      padding-inline: 0;
    }

    /* Small screens: the icon is enough on the trigger */
    @media (max-width: 640px) {
      .view-trigger {
        padding: 0 8px 0 10px;
      }
      .view-trigger-label {
        display: none;
      }
    }
  `
})
export class HeaderViewSwitchComponent {
  auth = inject(AuthService);
  adminView = inject(AdminViewService);
  private ordersService = inject(OrdersService);
  private maintenance = inject(MaintenanceService);

  readonly options: ViewOption[] = [
    { view: 'admin', icon: 'pi pi-chart-bar' },
    { view: 'user', icon: 'pi pi-shop' },
  ];
  readonly current = computed(
    () => this.options.find((o) => o.view === this.adminView.view())!,
  );

  // Orders waiting to be handled (hidden when there are none)
  pendingOrders = computed(() => this.ordersService.pendingCount());

  readonly isMobile = injectIsMobile();
  readonly sheetOpen = signal(false);
  private popover = viewChild(Popover);
  private sheet = viewChild(BottomDrawerComponent);

  constructor() {
    // Fetched once an admin is logged in (the session is only known in the browser)
    effect(() => {
      if (this.auth.isAdmin()) {
        untracked(() => {
          this.ordersService.refreshPendingCount();
          this.maintenance.load().subscribe();
        });
      }
    });
  }

  toggle(event: Event) {
    if (!this.isMobile()) {
      this.popover()?.toggle(event);
    } else if (this.sheetOpen()) {
      this.sheet()?.close();
    } else {
      this.sheetOpen.set(true);
    }
  }

  select(view: AppView) {
    this.adminView.switchTo(view);
    if (this.isMobile()) this.sheet()?.close();
    else this.popover()?.hide();
  }
}
