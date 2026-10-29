import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

export type ProfileTab = 'products' | 'designs' | 'collections';

// "?tab=designs" or "?tab=collections" in the address, products otherwise
export const profileTab = (value: string | null): ProfileTab =>
  value === 'designs' || value === 'collections' ? value : 'products';

// Products / Designs / Collections switch under a profile header (Instagram's posts / saved tabs).
// The tab is kept in the address so it can be shared and survives a reload
@Component({
  selector: 'app-profile-tabs',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <nav class="profile-tabs" [attr.aria-label]="'profile.tabs' | translate">
      <a
        [routerLink]="[]"
        [queryParams]="{ tab: null }"
        queryParamsHandling="merge"
        [replaceUrl]="true"
        [class.active]="active === 'products'"
        [attr.aria-current]="active === 'products' ? 'page' : null"
      >
        <i class="pi pi-th-large"></i>
        {{ 'profile.tabProducts' | translate }}
      </a>
      <a
        [routerLink]="[]"
        [queryParams]="{ tab: 'designs' }"
        queryParamsHandling="merge"
        [replaceUrl]="true"
        [class.active]="active === 'designs'"
        [attr.aria-current]="active === 'designs' ? 'page' : null"
      >
        <i class="pi pi-images"></i>
        {{ 'profile.tabDesigns' | translate }}
      </a>
      <a
        [routerLink]="[]"
        [queryParams]="{ tab: 'collections' }"
        queryParamsHandling="merge"
        [replaceUrl]="true"
        [class.active]="active === 'collections'"
        [attr.aria-current]="active === 'collections' ? 'page' : null"
      >
        <i class="pi pi-objects-column"></i>
        {{ 'profile.tabCollections' | translate }}
      </a>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 20px;
    }

    // Centered links on a line across the page, the active one marked on top of it
    .profile-tabs {
      display: flex;
      justify-content: center;
      gap: 48px;
      border-top: var(--global-border);
    }

    a {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: -1px;
      padding: 14px 4px;
      border-top: 2px solid transparent;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--p-app-surface-500);
      cursor: pointer;

      &:hover {
        color: var(--p-app-surface-800);
      }

      &.active {
        border-top-color: var(--p-app-surface-950);
        color: var(--p-app-surface-950);
      }

      i {
        font-size: 13px;
      }
    }

    @media (max-width: 640px) {
      .profile-tabs {
        gap: 0;
      }

      a {
        flex: 1;
        justify-content: center;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileTabsComponent {
  @Input() active: ProfileTab = 'products';
}
