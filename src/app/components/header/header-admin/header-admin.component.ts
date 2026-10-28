import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { AuthService } from '../../../services/auth/auth.service';
import { MaintenanceService } from '../../../services/maintenance/maintenance.service';
import { OrdersService } from '../../../services/orders/orders.service';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import {
  AccountLink,
  AccountLinkId,
  ADMIN_LINKS,
} from '../../../shared/account-links';

// Admins only: a button in the header actions opening a sidebar with every admin page.
// The session lives in localStorage, so the server never renders it: ngSkipHydration
// makes the browser render this part from scratch instead of reusing the server markup
// The drawer is appended to body, so its styles can't be encapsulated
@Component({
  selector: 'app-header-admin',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    DrawerModule,
    RouterModule,
    DialogComponent,
  ],
  host: { ngSkipHydration: 'true' },
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (auth.isAdmin()) {
      <span class="admin-trigger">
        <p-button
          size="small"
          icon="pi pi-cog"
          [text]="true"
          severity="secondary"
          [ariaLabel]="'header.openAdminMenu' | translate"
          aria-controls="admin-drawer-nav"
          [attr.aria-expanded]="open()"
          (onClick)="toggle()"
        />
        @if (pendingOrders(); as pending) {
          <span
            class="admin-trigger-badge"
            [title]="'account.pendingOrders' | translate: { count: pending }"
          >
            {{ pending > 99 ? '99+' : pending }}
          </span>
        }
      </span>
      <p-drawer
        [visible]="open()"
        (visibleChange)="open.set($event)"
        position="right"
        [blockScroll]="true"
        [closeOnEscape]="!confirmOpen()"
        styleClass="admin-drawer"
      >
        <ng-template #header>
          <span class="admin-drawer-title">{{
            'account.admin' | translate
          }}</span>
        </ng-template>
        <nav
          id="admin-drawer-nav"
          class="admin-drawer-links"
          [attr.aria-label]="'header.adminNav' | translate"
        >
          @for (item of links(); track item.link) {
            <a
              class="admin-drawer-link"
              [routerLink]="item.link"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              (click)="open.set(false)"
            >
              <i [class]="item.icon"></i>
              <span>{{ item.label | translate }}</span>
              @if (item.count != null) {
                <span class="admin-drawer-badge">{{ item.count }}</span>
              }
            </a>
          }
        </nav>
        <ng-template #footer>
          <div class="admin-maintenance">
            <p
              class="admin-maintenance-status"
              [class.on]="maintenance.enabled()"
              role="status"
            >
              <span class="admin-maintenance-dot" aria-hidden="true"></span>
              {{
                (maintenance.enabled()
                  ? 'maintenance.admin.statusOn'
                  : 'maintenance.admin.statusOff'
                ) | translate
              }}
            </p>
            <button
              pButton
              class="admin-maintenance-toggle"
              [severity]="maintenance.enabled() ? 'success' : 'danger'"
              [outlined]="true"
              [icon]="maintenance.enabled() ? 'pi pi-play' : 'pi pi-power-off'"
              [label]="
                (maintenance.enabled()
                  ? 'maintenance.admin.reopen'
                  : 'maintenance.admin.enable'
                ) | translate
              "
              [disabled]="!maintenance.state()"
              (click)="askToggle()"
            ></button>
          </div>
        </ng-template>
      </p-drawer>

      <!-- What the change does, before doing it -->
      <app-dialog
        [(open)]="confirmOpen"
        [header]="
          (enabling()
            ? 'maintenance.admin.enableTitle'
            : 'maintenance.admin.reopenTitle'
          ) | translate
        "
        [closable]="!saving()"
        [dismissableMask]="!saving()"
      >
        <div class="admin-maintenance-dialog">
          @if (enabling()) {
            <p>{{ 'maintenance.admin.enableText' | translate }}</p>
            <ul>
              <li>{{ 'maintenance.admin.enableVisitors' | translate }}</li>
              <li>{{ 'maintenance.admin.enableOrders' | translate }}</li>
              <li>{{ 'maintenance.admin.enableAdmins' | translate }}</li>
            </ul>
          } @else {
            <p>{{ 'maintenance.admin.reopenText' | translate }}</p>
          }
          @if (error()) {
            <p class="admin-maintenance-error" role="alert">
              {{ 'maintenance.admin.error' | translate }}
            </p>
          }
        </div>
        <div dialogFooter class="admin-maintenance-actions">
          <button
            pButton
            severity="secondary"
            [text]="true"
            [label]="'common.cancel' | translate"
            [disabled]="saving()"
            (click)="confirmOpen.set(false)"
          ></button>
          <button
            pButton
            [severity]="enabling() ? 'danger' : 'success'"
            [icon]="
              saving()
                ? 'pi pi-spin pi-spinner'
                : enabling()
                  ? 'pi pi-power-off'
                  : 'pi pi-play'
            "
            [label]="
              (enabling()
                ? 'maintenance.admin.enableConfirm'
                : 'maintenance.admin.reopenConfirm'
              ) | translate
            "
            [disabled]="saving()"
            (click)="toggleMaintenance()"
          ></button>
        </div>
      </app-dialog>
    }
  `,
  styles: `
    app-header-admin {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .admin-trigger {
      position: relative;
      display: inline-flex;
    }

    .admin-trigger-badge {
      position: absolute;
      top: -0.2rem;
      right: -0.3rem;
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

    /* Narrower than the cart drawer whose defaults it shares */
    .p-drawer.admin-drawer {
      width: 280px !important;
    }

    .admin-drawer-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--p-app-surface-950);
    }

    .admin-drawer .p-drawer-content {
      padding: 10px !important;
    }

    .admin-drawer-links {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .admin-drawer-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      height: 42px;
      padding: 0.5rem 0.7rem;
      border-radius: var(--button-radius);
      color: var(--p-app-surface-700);
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s;
    }

    .admin-drawer-link i {
      color: var(--p-app-surface-500);
    }

    .admin-drawer-link:hover {
      background: var(--p-app-primary-50);
    }

    .admin-drawer-link.active {
      background: var(--p-app-primary-50);
      color: var(--p-app-primary-500);
      font-weight: 600;
    }

    .admin-drawer-link.active i {
      color: var(--p-app-primary-500);
    }

    .admin-drawer-badge {
      margin-left: auto;
      padding: 0.1rem 0.5rem;
      border-radius: var(--tags-radius);
      background: var(--p-app-surface-100);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .admin-drawer-link.active .admin-drawer-badge {
      background: var(--p-app-surface-200);
    }

    .admin-drawer .p-drawer-footer {
      padding: 1rem;
      border-top: 1px solid var(--p-app-surface-100);
    }

    .admin-maintenance {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .admin-maintenance-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      padding: 0 0.2rem;
      font-size: 0.8rem;
      color: var(--p-app-surface-500);
    }

    .admin-maintenance-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--p-green-500);
    }

    .admin-maintenance-status.on {
      color: var(--p-orange-500);
      font-weight: 600;
    }

    .admin-maintenance-status.on .admin-maintenance-dot {
      background: var(--p-orange-500);
    }

    .admin-maintenance-toggle {
      width: 100%;
    }

    .admin-maintenance-dialog p {
      margin: 0;
      line-height: 1.5;
    }

    .admin-maintenance-dialog ul {
      margin: 0.75rem 0 0;
      padding-left: 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      line-height: 1.45;
      color: var(--p-app-surface-700);
    }

    .admin-maintenance-dialog .admin-maintenance-error {
      margin-top: 0.75rem;
      color: var(--p-red-500);
    }

    .admin-maintenance-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .admin-maintenance-actions .p-button {
      white-space: nowrap;
    }
  `,
})
export class HeaderAdminComponent {
  auth = inject(AuthService);
  private ordersService = inject(OrdersService);
  maintenance = inject(MaintenanceService);

  readonly open = signal(false);
  readonly confirmOpen = signal(false);
  // What the dialog offers, fixed when it opens: putting in maintenance or reopening
  readonly enabling = signal(true);
  readonly saving = signal(false);
  readonly error = signal(false);

  // Orders waiting to be handled (hidden when there are none)
  pendingOrders = computed(() => this.ordersService.pendingCount());

  links = computed<(AccountLink & { count?: number | null })[]>(() => {
    const counts: Partial<Record<AccountLinkId, number | null>> = {
      manageOrders: this.ordersService.pendingCount(),
    };
    return ADMIN_LINKS.map((link) => ({ ...link, count: counts[link.id] }));
  });

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

  toggle() {
    if (!this.open()) {
      this.ordersService.refreshPendingCount();
      this.maintenance.load().subscribe();
    }
    this.open.set(!this.open());
  }

  askToggle() {
    this.enabling.set(!this.maintenance.enabled());
    this.error.set(false);
    this.confirmOpen.set(true);
  }

  toggleMaintenance() {
    this.saving.set(true);
    this.error.set(false);
    this.maintenance.setEnabled(this.enabling()).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmOpen.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.error.set(true);
      },
    });
  }
}
