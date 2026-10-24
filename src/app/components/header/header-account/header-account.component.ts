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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Params, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../../services/auth/auth.service';
import { ProductsService } from '../../../services/products/products.service';
import { OrdersService } from '../../../services/orders/orders.service';
import { TranslatePipe } from '@ngx-translate/core';
import {
  BottomDrawerComponent,
  injectIsMobile,
} from '../../bottom-drawer/bottom-drawer.component';

interface AccountLink {
  label: string;
  icon: string;
  link: string;
  count?: number | null;
}

interface AccountSection {
  id: string;
  title?: string;
  links: AccountLink[];
}

// Sign in button, or the account popover once logged in (a skeleton until the
// session is checked, so the wrong one never flashes on reload).
// The session lives in localStorage, so the server always renders the logged out
// state: ngSkipHydration makes the browser render this part from scratch instead
// of reusing the server markup (which would leave a stale "Sign in" button behind)
// The popover is appended to body, so its styles can't be encapsulated
// On mobile the same panel opens in a bottom sheet instead of the popover
@Component({
  selector: 'app-header-account',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TranslatePipe,
    BottomDrawerComponent,
    ButtonModule,
    PopoverModule,
    RouterModule,
    SkeletonModule,
  ],
  host: { ngSkipHydration: 'true' },
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (!auth.ready()) {
      <p-skeleton
        width="2.25rem"
        height="2.25rem"
        shape="circle"
        [ariaLabel]="'account.loading' | translate"
      />
    } @else {
      @if (auth.user(); as user) {
        <button
          type="button"
          class="account-trigger"
          [attr.aria-label]="'account.menu' | translate"
          aria-haspopup="dialog"
          (click)="toggle($event)"
        >
          {{ initials() }}
          @if (pendingOrders(); as pending) {
            <span
              class="account-trigger-badge"
              [title]="'account.pendingOrders' | translate: { count: pending }"
            >
              {{ pending > 99 ? '99+' : pending }}
            </span>
          }
        </button>
        <!-- Mobile: a bottom sheet; desktop: a popover. Both share the panel template -->
        @if (isMobile()) {
          @if (sheetOpen()) {
            <app-bottom-drawer
              class="account-sheet"
              [ariaLabel]="'account.menu' | translate"
              (doClose)="sheetOpen.set(false)"
            >
              <ng-container [ngTemplateOutlet]="accountPanel" />
            </app-bottom-drawer>
          }
        } @else {
          <p-popover
            appendTo="body"
            styleClass="account-popover"
            (onShow)="onPopoverShow()"
          >
            <ng-container [ngTemplateOutlet]="accountPanel" />
          </p-popover>
        }
        <ng-template #accountPanel>
          <div class="account-panel">
            <div class="account-header">
              <span class="account-avatar">{{ initials() }}</span>
              <div class="account-identity">
                <span class="account-name">{{ user.name }}</span>
                <span class="account-email">{{ user.email }}</span>
              </div>
            </div>

            @for (section of sections(); track section.id) {
              <nav
                class="account-section account-links"
                [attr.aria-label]="section.title ?? 'account.menu' | translate"
              >
                @if (section.title) {
                  <span class="account-section-title">{{
                    section.title | translate
                  }}</span>
                }
                @for (item of section.links; track item.link) {
                  <a
                    class="account-link"
                    [routerLink]="item.link"
                    routerLinkActive="active"
                    (click)="hide()"
                  >
                    <i [class]="item.icon"></i>
                    <span>{{ item.label | translate }}</span>
                    @if (item.count != null) {
                      <span class="account-badge">{{ item.count }}</span>
                    }
                  </a>
                }
              </nav>
            }

            <div class="account-section account-signout-section">
              <button
                pButton
                type="button"
                severity="danger"
                [outlined]="true"
                [text]="true"
                (click)="hide(); auth.logout()"
              >
                <i class="pi pi-sign-out"></i>
                <span>{{ 'account.signOut' | translate }}</span>
              </button>
            </div>
          </div>
        </ng-template>
      } @else {
        <p-button
          size="small"
          [label]="'common.signIn' | translate"
          icon="pi pi-sign-in"
          [routerLink]="['/auth']"
          [queryParams]="signInQueryParams"
        />
      }
    }
  `,
  styles: `
    app-header-account {
      display: flex;
      align-items: center;
    }

    .account-trigger,
    .account-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border-radius: var(--button-radius);
      background: var(--p-app-primary-500);
      color: var(--p-app-surface-0);
      font-weight: 600;
    }

    .account-trigger {
      position: relative;
      width: 2rem;
      height: 2rem;
      border: none;
      font-size: 0.75rem;
      cursor: pointer;
      transition: box-shadow 0.15s;
    }

    .account-trigger-badge {
      position: absolute;
      top: -0.3rem;
      right: -0.4rem;
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
      box-sizing: border-box;
    }

    .account-trigger:hover,
    .account-trigger:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--p-app-primary-500) 35%, transparent);
    }

    .account-popover.p-popover {
      border-radius: var(--card-radius);
      overflow: hidden;
    }

    .account-popover .p-popover-content {
      padding: 0;
    }

    .account-panel {
      width: auto;
      color: var(--p-app-surface-700);
      min-width: 250px;
    }

    .account-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      border-bottom: 1px solid var(--p-app-surface-200);
    }

    .account-avatar {
      width: 2rem;
      height: 2rem;
      font-size: 0.75rem;
    }

    .account-identity {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .account-name {
      font-weight: 600;
      line-height: normal;
    }

    .account-email {
      font-size: 0.85rem;
      color: var(--p-app-surface-500);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: normal;
    }

    .account-section {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding: 0.5rem;
    }

    .account-section + .account-section {
      border-top: 1px solid var(--p-app-surface-200);
    }

    .account-section-title {
      font-size: 0.75rem;
      margin-bottom: 0.25rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--p-app-surface-500);
    }

    .account-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.5rem 0.7rem;
      border: none;
      border-radius: var(--button-radius);
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s;
    }

    .account-link i {
      color: var(--p-app-surface-500);
    }

    .account-link.active {
      outline: none;
      background: var(--p-app-primary-50);
      color: var(--p-app-primary-500);
    }

    .account-link:hover {
      background: var(--p-app-primary-50);
    }

    .account-link.active i {
      color: var(--p-app-primary-500);
    }

    .account-badge {
      margin-left: auto;
      padding: 0.1rem 0.5rem;
      border-radius: var(--tags-radius);
      background: var(--p-app-surface-100);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .account-link.active .account-badge {
      background: var(--p-app-surface-200);
    }

    .account-signout,
    .account-signout i {
      color: var(--p-red-400);
    }

    /* Mobile bottom sheet: it already pads its sides, links get larger tap targets */
    .account-sheet .account-header {
      padding: 0.25rem 0.5rem 1rem;
    }

    .account-sheet .account-section {
      padding-inline: 0;
    }

    .account-sheet .account-signout-section {
      padding-bottom: 0;
    }

    .account-sheet .account-link {
      padding-block: 0.8rem;
    }
  `,
})
export class HeaderAccountComponent {
  auth = inject(AuthService);
  private productsService = inject(ProductsService);
  private ordersService = inject(OrdersService);
  private router = inject(Router);

  readonly isMobile = injectIsMobile();
  readonly sheetOpen = signal(false);
  private popover = viewChild(Popover);
  private sheet = viewChild(BottomDrawerComponent);

  // Brings the user back to the current page after signing in
  signInQueryParams: Params = this.returnUrlParams(this.router.url);

  // Fetched each time the popover opens, so it follows saves and deletes
  private designsCount = signal<number | null>(null);

  // Admin only: orders waiting to be handled (hidden when there are none)
  pendingOrders = computed(() =>
    this.auth.isAdmin() ? this.ordersService.pendingCount() : null,
  );

  initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    const words = (user.name || user.username || user.email)
      .trim()
      .split(/\s+/);
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  });

  // Links of every user, then the admin pages grouped under their own title
  sections = computed<AccountSection[]>(() => {
    const user = this.auth.user();
    if (!user) return [];
    const sections: AccountSection[] = [
      {
        id: 'account',
        links: [
          {
            label: 'common.myDesigns',
            icon: 'pi pi-palette',
            link: '/my_product',
            count: this.designsCount(),
          },
          {
            label: 'common.myOrders',
            icon: 'pi pi-box',
            link: '/my_order',
          },
        ],
      },
    ];
    if (user.role === 'admin') {
      sections.push({
        id: 'admin',
        title: 'account.admin',
        links: [
          {
            label: 'common.manageDesigns',
            icon: 'pi pi-images',
            link: '/design_manage',
          },
          {
            label: 'common.savedProducts',
            icon: 'pi pi-bookmark',
            link: '/saved-products',
          },
          {
            label: 'common.manageCollections',
            icon: 'pi pi-th-large',
            link: '/manage_collections',
          },
          {
            label: 'common.manageOrders',
            icon: 'pi pi-inbox',
            link: '/manage_orders',
            count: this.ordersService.pendingCount(),
          },
          {
            label: 'common.pricing',
            icon: 'pi pi-tag',
            link: '/pricing',
          },
        ],
      });
    }
    return sections;
  });

  constructor() {
    // Fetched once an admin is logged in (the session is only known in the browser)
    effect(() => {
      if (this.auth.isAdmin()) {
        untracked(() => this.ordersService.refreshPendingCount());
      }
    });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event: NavigationEnd) => {
        this.signInQueryParams = this.returnUrlParams(event.urlAfterRedirects);
      });
  }

  toggle(event: Event) {
    if (!this.isMobile()) {
      this.popover()?.toggle(event);
    } else if (this.sheetOpen()) {
      this.hide();
    } else {
      this.sheetOpen.set(true);
      this.onPopoverShow();
    }
  }

  // The sheet slides down before it unmounts
  hide() {
    const sheet = this.sheet();
    if (sheet) sheet.close();
    else this.popover()?.hide();
  }

  onPopoverShow() {
    this.loadDesignsCount();
    if (this.auth.isAdmin()) this.ordersService.refreshPendingCount();
  }

  loadDesignsCount() {
    // Only the total is needed: a one item page carries it
    this.productsService
      .getProductsPage({ mine: true, page: 1, size: 1 })
      .subscribe({
        next: (page) => this.designsCount.set(page.count),
        error: () => this.designsCount.set(null),
      });
  }

  private returnUrlParams(url: string): Params {
    return url === '/' || url.startsWith('/auth') ? {} : { returnUrl: url };
  }
}
