import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../services/auth/auth.service';

// Sellers only: the way to their seller dashboard from the shop header (icon alone on small
// screens). The session lives in localStorage, so the server never renders it: ngSkipHydration
// makes the browser render this part from scratch instead of reusing the server markup
@Component({
    selector: 'app-header-seller',
    imports: [RouterLink, TranslatePipe],
    host: { ngSkipHydration: 'true' },
    template: `
    @if (auth.isSeller()) {
      <a
        routerLink="/seller"
        class="seller-trigger"
        [attr.aria-label]="'seller.links.dashboard' | translate"
        [title]="'seller.links.dashboard' | translate"
      >
        <i class="pi pi-chart-line" aria-hidden="true"></i>
        <span class="seller-trigger-label">{{ 'seller.links.dashboard' | translate }}</span>
      </a>
    }
  `,
    styles: `
    :host {
      display: contents;
    }
    .seller-trigger {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 0 12px;
      border: var(--global-border);
      border-radius: var(--button-radius);
      background: var(--p-app-surface-0);
      color: var(--p-app-surface-700);
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      text-decoration: none;
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s;
    }
    .seller-trigger i {
      color: var(--p-app-primary-500);
    }
    .seller-trigger:hover {
      background: var(--p-app-surface-100);
      color: var(--p-app-surface-900);
    }
    .seller-trigger:focus-visible {
      outline: 2px solid var(--p-app-primary-500);
      outline-offset: 2px;
    }
    @media (max-width: 768px) {
      .seller-trigger {
        width: 36px;
        padding: 0;
        justify-content: center;
      }
      .seller-trigger-label {
        display: none;
      }
    }
  `
})
export class HeaderSellerComponent {
  auth = inject(AuthService);
}
