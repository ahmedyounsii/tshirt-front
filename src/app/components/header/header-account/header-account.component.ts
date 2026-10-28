import {
  Component,
  computed,
  inject,
  signal,
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
import { TranslatePipe } from '@ngx-translate/core';
import {
  BottomDrawerComponent,
  injectIsMobile,
} from '../../bottom-drawer/bottom-drawer.component';
import { AccountLink, USER_LINKS } from '../../../shared/account-links';
import { AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { TagComponent } from '../../tag/tag.component';

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
    AvatarUrlPipe,
    BottomDrawerComponent,
    ButtonModule,
    PopoverModule,
    RouterModule,
    SkeletonModule,
    TagComponent,
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
          <ng-container [ngTemplateOutlet]="avatar" />
        </button>
        <ng-template #avatar>
          @if (user.avatar) {
            <img [src]="user.avatar | avatarUrl" alt="" />
          } @else {
            {{ initials() }}
          }
        </ng-template>
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
          <p-popover appendTo="body" styleClass="account-popover">
            <ng-container [ngTemplateOutlet]="accountPanel" />
          </p-popover>
        }
        <ng-template #accountPanel>
          <div class="account-panel">
            <div class="account-header">
              <span class="account-avatar">
                <ng-container [ngTemplateOutlet]="avatar" />
              </span>
              <div class="account-identity">
                <span class="account-name">
                  {{ user.name }}
                  <!-- Regular users get no tag -->
                  @if (auth.isSuperAdmin()) {
                    <app-tag variant="soft" size="xs" icon="pi pi-crown">
                      {{ "settings.superAdmin" | translate }}
                    </app-tag>
                  } @else if (auth.isAdmin()) {
                    <app-tag variant="soft" size="xs" icon="pi pi-shield">
                      {{ "settings.admin" | translate }}
                    </app-tag>
                  }
                </span>
                <span class="account-email">{{ user.email }}</span>
              </div>
            </div>

            <!-- Settings first, set apart from the account pages -->
            <div class="account-section">
              <a
                class="account-link"
                routerLink="/settings"
                routerLinkActive="active"
                (click)="hide()"
              >
                <i class="pi pi-cog"></i>
                <span>{{ 'account.settings' | translate }}</span>
              </a>
            </div>

            <nav
              class="account-section account-links"
              [attr.aria-label]="'account.menu' | translate"
            >
              @for (item of links; track item.link) {
                <a
                  class="account-link"
                  [routerLink]="item.link"
                  routerLinkActive="active"
                  (click)="hide()"
                >
                  <i [class]="item.icon"></i>
                  <span>{{ item.label | translate }}</span>
                </a>
              }
            </nav>

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
      border-radius: 50%;
      background: var(--p-app-primary-500);
      color: var(--p-app-surface-0);
      overflow: hidden;
      font-weight: 600;
    }

    .account-trigger img,
    .account-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
    }

    .account-trigger {
      position: relative;
      padding: 0;
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
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
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

    .account-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      height: 38px;
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
  private router = inject(Router);

  readonly isMobile = injectIsMobile();
  readonly sheetOpen = signal(false);
  private popover = viewChild(Popover);
  private sheet = viewChild(BottomDrawerComponent);

  // Brings the user back to the current page after signing in
  signInQueryParams: Params = this.returnUrlParams(this.router.url);

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

  // The products tab is the store's home: the menu names it after the user's store
  // (the admin pages have their own sidebar, opened next to the logo)
  links: AccountLink[] = USER_LINKS.map((link) =>
    link.id === 'products'
      ? { ...link, label: 'common.myStore', icon: 'pi pi-shop' }
      : link,
  );

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

  toggle(event: Event) {
    if (!this.isMobile()) {
      this.popover()?.toggle(event);
    } else if (this.sheetOpen()) {
      this.hide();
    } else {
      this.sheetOpen.set(true);
    }
  }

  // The sheet slides down before it unmounts
  hide() {
    const sheet = this.sheet();
    if (sheet) sheet.close();
    else this.popover()?.hide();
  }

  private returnUrlParams(url: string): Params {
    return url === '/' || url.startsWith('/auth') ? {} : { returnUrl: url };
  }
}
