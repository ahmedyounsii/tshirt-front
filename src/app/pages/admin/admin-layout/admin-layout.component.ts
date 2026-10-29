import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminViewService } from '../../../services/admin-view/admin-view.service';
import { AuthService } from '../../../services/auth/auth.service';
import { OrdersService } from '../../../services/orders/orders.service';
import {
  AccountLink,
  AccountLinkId,
  ADMIN_LINKS,
} from '../../../shared/account-links';
import { LogoTextComponent } from '../../../components/logo-text/logo-text.component';
import { LogoComponent } from '../../../components/logo/logo.component';
import { HeaderViewSwitchComponent } from '../../../components/header/header-view-switch/header-view-switch.component';
import { HeaderLanguageComponent } from '../../../components/header/header-language/header-language.component';
import { HeaderThemeComponent } from '../../../components/header/header-theme/header-theme.component';
import { HeaderAccountComponent } from '../../../components/header/header-account/header-account.component';
import { AdminMaintenanceComponent } from '../admin-maintenance/admin-maintenance.component';
import { injectIsMobile } from '../../../components/bottom-drawer/bottom-drawer.component';

// A link with children is a button opening them
type SidebarLink = AccountLink & {
  exact: boolean;
  count?: number | null;
  children?: SidebarLink[];
};

// Links of the pages listed under another link
const childLinks = (id: AccountLinkId) => ADMIN_LINKS.filter((l) => l.parent === id);

// Sections of the sidebar, each listing admin pages by id (superAdmin: shown to the super admin only)
const SIDEBAR_GROUPS: { label: string; links: AccountLinkId[]; superAdmin?: boolean }[] = [
  { label: 'adminView.groups.overview', links: ['dashboard'] },
  { label: 'adminView.groups.sales', links: ['manageOrders', 'discounts', 'pricing'] },
  { label: 'adminView.groups.catalog', links: ['designs', 'savedProducts', 'collections'] },
  { label: 'adminView.groups.team', links: ['admins'], superAdmin: true },
];

const COLLAPSED_KEY = 'admin-sidebar-collapsed';

// Frame of every /admin page in the admin view: the sidebar on the left (a panel
// sliding over the page on small screens) and a top bar with the view switch and the
// header actions, the page under it. Replaces the shop header while it's shown
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterModule,
    NgTemplateOutlet,
    TranslatePipe,
    LogoTextComponent,
    LogoComponent,
    HeaderViewSwitchComponent,
    HeaderLanguageComponent,
    HeaderThemeComponent,
    HeaderAccountComponent,
    AdminMaintenanceComponent,
  ],
  host: {
    '(document:keydown.escape)': 'adminView.sidebarOpen.set(false)',
    '[class.collapsed]': 'collapsed()',
  },
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  adminView = inject(AdminViewService);
  private ordersService = inject(OrdersService);
  private auth = inject(AuthService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly isMobile = injectIsMobile();

  // Desktop only: the sidebar shrinks to a rail of icons, remembered on this browser
  readonly collapsed = signal(this.readCollapsed());

  readonly groups = computed(() => {
    const counts: Partial<Record<AccountLinkId, number | null>> = {
      manageOrders: this.ordersService.pendingCount(),
    };
    const superAdmin = this.auth.isSuperAdmin();
    const toSidebarLink = (link: AccountLink): SidebarLink => {
      const children = childLinks(link.id).map(toSidebarLink);
      return {
        ...link,
        // Pages with others under their URL
        exact: link.id === 'dashboard' || link.id === 'designList',
        count: counts[link.id],
        ...(children.length ? { children } : {}),
      };
    };
    return SIDEBAR_GROUPS.filter((group) => !group.superAdmin || superAdmin).map((group) => ({
      label: group.label,
      links: group.links.map((id) => toSidebarLink(ADMIN_LINKS.find((l) => l.id === id)!)),
    }));
  });

  // Page shown, named in the top bar: the link its URL starts with (longest first),
  // links opening others aside
  readonly current = computed(() => {
    const path = this.adminView.url().split(/[?#]/)[0];
    return [...ADMIN_LINKS]
      .filter((l) => !childLinks(l.id).length)
      .sort((a, b) => b.link.length - a.link.length)
      .find((l) => path === l.link || path.startsWith(`${l.link}/`));
  });

  // Link the page shown is listed under, named before it in the top bar
  readonly currentParent = computed(() => {
    const parent = this.current()?.parent;
    return parent ? ADMIN_LINKS.find((l) => l.id === parent) : undefined;
  });

  // Links opened or closed by the user; the one of the page shown starts open
  private readonly toggled = signal<Partial<Record<AccountLinkId, boolean>>>({});

  isOpen(link: SidebarLink): boolean {
    return this.toggled()[link.id] ?? this.currentParent()?.id === link.id;
  }

  toggleOpen(link: SidebarLink) {
    const open = !this.isOpen(link);
    this.toggled.update((toggled) => ({ ...toggled, [link.id]: open }));
  }

  // Button of the top bar: the rail on desktop, the sliding panel on small screens
  toggleMenu() {
    if (this.isMobile()) this.adminView.sidebarOpen.set(!this.adminView.sidebarOpen());
    else this.toggleCollapsed();
  }

  toggleCollapsed() {
    const collapsed = !this.collapsed();
    this.collapsed.set(collapsed);
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // Storage blocked: the sidebar just won't stay collapsed after a reload
    }
  }

  private readCollapsed(): boolean {
    if (!this.isBrowser) return false;
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }
}
