import {
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Params, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '../../../services/auth/auth.service';
import { ThemeMode, ThemeService } from '../../../services/theme.service';
import { TshirtsService } from '../../../services/tshirts/tshirts.service';

interface AccountLink {
  label: string;
  icon: string;
  link: string;
  count?: number | null;
}

// Sign in button, or the account popover once logged in (a skeleton until the
// session is checked, so the wrong one never flashes on reload).
// The session lives in localStorage, so the server always renders the logged out
// state: ngSkipHydration makes the browser render this part from scratch instead
// of reusing the server markup (which would leave a stale "Sign in" button behind)
// The popover is appended to body, so its styles can't be encapsulated
@Component({
  selector: 'app-header-account',
  standalone: true,
  imports: [ButtonModule, PopoverModule, RouterModule, SkeletonModule],
  host: { ngSkipHydration: 'true' },
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (!auth.ready()) {
      <p-skeleton
        width="2.25rem"
        height="2.25rem"
        shape="circle"
        ariaLabel="Loading account"
      />
    } @else {
      @if (auth.user(); as user) {
        <button
          type="button"
          class="account-trigger"
          aria-label="Account menu"
          aria-haspopup="dialog"
          (click)="accountPopover.toggle($event)"
        >
          {{ initials() }}
        </button>
        <p-popover
          #accountPopover
          appendTo="body"
          styleClass="account-popover"
          (onShow)="loadDesignsCount()"
        >
          <div class="account-panel">
            <div class="account-header">
              <span class="account-avatar">{{ initials() }}</span>
              <div class="account-identity">
                <span class="account-name">{{ user.name }}</span>
                <span class="account-email">{{ user.email }}</span>
              </div>
            </div>

            <nav class="account-section account-links">
              @for (item of links(); track item.link) {
                <a
                  class="account-link"
                  [routerLink]="item.link"
                  routerLinkActive="active"
                  (click)="accountPopover.hide()"
                >
                  <i [class]="item.icon"></i>
                  <span>{{ item.label }}</span>
                  @if (item.count != null) {
                    <span class="account-badge">{{ item.count }}</span>
                  }
                </a>
              }
            </nav>

            <div class="account-section">
              <span class="account-section-title">Theme</span>
              <div class="theme-switch" role="radiogroup" aria-label="Theme">
                @for (option of themeOptions; track option.mode) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="
                      theme.isDark() === (option.mode === 'dark')
                    "
                    [class.active]="theme.isDark() === (option.mode === 'dark')"
                    (click)="theme.setMode(option.mode)"
                  >
                    <i [class]="option.icon"></i>
                    {{ option.label }}
                  </button>
                }
              </div>
            </div>

            <div class="account-section">
              <button
                type="button"
                class="account-link account-signout"
                (click)="accountPopover.hide(); auth.logout()"
              >
                <i class="pi pi-sign-out"></i>
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </p-popover>
      } @else {
        <p-button
          size="small"
          [rounded]="true"
          label="Sign in"
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
      border-radius: 50%;
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      font-weight: 700;
    }

    .account-trigger {
      width: 2rem;
      height: 2rem;
      border: none;
      font-size: 0.75rem;
      cursor: pointer;
      transition: box-shadow 0.15s;
    }

    .account-trigger:hover,
    .account-trigger:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--p-primary-color) 35%, transparent);
    }

    .account-popover.p-popover {
      border-radius: 1rem;
      overflow: hidden;
    }

    .account-popover .p-popover-content {
      padding: 0;
    }

    .account-panel {
      width: 17rem;
      color: var(--p-text-color);
    }

    .account-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      border-bottom: 1px solid var(--p-content-border-color);
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
      font-weight: 700;
      line-height: normal;
    }

    .account-email {
      font-size: 0.85rem;
      color: var(--p-text-muted-color);
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
      border-top: 1px solid var(--p-content-border-color);
    }

    .account-section-title {
      font-size: 0.75rem;
      margin-bottom: 0.25rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
    }

    .account-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.5rem 0.7rem;
      border: none;
      border-radius: 0.5rem;
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s;
    }

    .account-link i {
      color: var(--p-text-muted-color);
    }

    .account-link:hover,
    .account-link:focus-visible,
    .account-link.active {
      outline: none;
      background: var(--p-content-hover-background);
    }

    .account-link.active i {
      color: var(--p-primary-color);
    }

    .account-badge {
      margin-left: auto;
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      background: var(--p-content-hover-background);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .account-link.active .account-badge {
      background: var(--p-content-border-color);
    }

    .theme-switch {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.25rem;
      padding: 0.25rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 0.6rem;
    }

    .theme-switch button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.25rem 0.25rem;
      border: none;
      border-radius: 0.45rem;
      background: none;
      color: var(--p-text-muted-color);
      font: inherit;
      font-size: 0.75rem;
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s;
    }

    .theme-switch button i {
      font-size: 0.75rem;
    }

    .theme-switch button:hover,
    .theme-switch button:focus-visible {
      outline: none;
      color: var(--p-text-color);
    }

    .theme-switch button.active {
      background: var(--p-content-hover-background);
      color: var(--p-text-color);
    }

    .account-signout,
    .account-signout i {
      color: var(--p-red-400);
    }
  `,
})
export class HeaderAccountComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  private tshirtsService = inject(TshirtsService);
  private router = inject(Router);

  // Brings the user back to the current page after signing in
  signInQueryParams: Params = this.returnUrlParams(this.router.url);

  // Fetched each time the popover opens, so it follows saves and deletes
  private designsCount = signal<number | null>(null);

  readonly themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Light', icon: 'pi pi-sun' },
    { mode: 'dark', label: 'Dark', icon: 'pi pi-moon' },
  ];

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

  links = computed<AccountLink[]>(() => {
    const user = this.auth.user();
    if (!user) return [];
    return [
      {
        label: 'My designs',
        icon: 'pi pi-palette',
        link: '/my_design',
        count: this.designsCount(),
      },
      ...(user.role === 'admin'
        ? [
            {
              label: 'Saved T-shirts',
              icon: 'pi pi-bookmark',
              link: '/saved-tshirts',
            },
          ]
        : []),
    ];
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event: NavigationEnd) => {
        this.signInQueryParams = this.returnUrlParams(event.urlAfterRedirects);
      });
  }

  loadDesignsCount() {
    // Only the total is needed: a one item page carries it
    this.tshirtsService.getTshirtsPage({ mine: true, page: 1, size: 1 }).subscribe({
      next: (page) => this.designsCount.set(page.count),
      error: () => this.designsCount.set(null),
    });
  }

  private returnUrlParams(url: string): Params {
    return url === '/' || url.startsWith('/auth') ? {} : { returnUrl: url };
  }
}
