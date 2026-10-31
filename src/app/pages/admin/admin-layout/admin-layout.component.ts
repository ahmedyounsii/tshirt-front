import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminViewService } from '../../../services/admin-view/admin-view.service';
import { AuthService } from '../../../services/auth/auth.service';
import { OrdersService } from '../../../services/orders/orders.service';
import {
  AccountLink,
  AccountLinkId,
  ADMIN_LINKS,
  SELLER_LINKS,
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

// Panels using this frame, picked by the route's data.panel: the admin view and the
// seller dashboard. Same sidebar and top bar, each with its own pages
export type PanelId = 'admin' | 'seller';

interface PanelConfig {
  root: string;
  links: AccountLink[];
  // Sections of the sidebar, each listing pages by id (superAdmin: shown to the super admin only)
  groups: { label: string; links: AccountLinkId[]; superAdmin?: boolean }[];
  // The panel's home, and the pages with others under their URL
  home: AccountLinkId;
  exact: AccountLinkId[];
  // Badge next to the logo and first crumb of the top bar
  badge: string;
  crumbRoot: string;
  // Maintenance switch at the bottom of the sidebar
  maintenance: boolean;
}

const PANELS: Record<PanelId, PanelConfig> = {
  admin: {
    root: '/admin',
    links: ADMIN_LINKS,
    groups: [
      { label: 'adminView.groups.overview', links: ['dashboard'] },
      { label: 'adminView.groups.sales', links: ['manageOrders', 'discounts', 'pricing', 'delivery'] },
      { label: 'adminView.groups.catalog', links: ['designs', 'savedProducts', 'collections'] },
      {
        label: 'adminView.groups.marketplace',
        links: ['sellerApplications', 'sellers', 'commission', 'revenue', 'audit'],
      },
      { label: 'adminView.groups.team', links: ['admins'], superAdmin: true },
    ],
    home: 'dashboard',
    exact: ['dashboard', 'designList'],
    badge: 'adminView.admin.short',
    crumbRoot: 'account.admin',
    maintenance: true,
  },
  seller: {
    root: '/seller',
    links: SELLER_LINKS,
    groups: [
      { label: 'adminView.groups.overview', links: ['sellerOverview'] },
      {
        label: 'adminView.groups.catalog',
        links: ['sellerDesigns', 'sellerProducts', 'sellerCollections'],
      },
      {
        label: 'adminView.groups.sales',
        links: ['sellerPromotions', 'sellerOrders', 'sellerEarnings'],
      },
      { label: 'seller.groups.store', links: ['sellerStore'] },
    ],
    home: 'sellerOverview',
    exact: ['sellerOverview'],
    badge: 'seller.badge',
    crumbRoot: 'seller.links.dashboard',
    maintenance: false,
  },
};

const COLLAPSED_KEY = 'admin-sidebar-collapsed';

// Frame of every /admin page in the admin view, and of the seller dashboard (/seller):
// the sidebar on the left (a panel sliding over the page on small screens) and a top bar
// with the view switch and the header actions, the page under it. Replaces the shop
// header while it's shown
@Component({
    selector: 'app-admin-layout',
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
    styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent {
  adminView = inject(AdminViewService);
  private ordersService = inject(OrdersService);
  private auth = inject(AuthService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly panelId: PanelId = inject(ActivatedRoute).snapshot.data['panel'] ?? 'admin';
  readonly panel = PANELS[this.panelId];

  // Links of the pages listed under another link
  private childLinks(id: AccountLinkId) {
    return this.panel.links.filter((l) => l.parent === id);
  }

  readonly isMobile = injectIsMobile();

  // Desktop only: the sidebar shrinks to a rail of icons, remembered on this browser
  readonly collapsed = signal(this.readCollapsed());

  readonly groups = computed(() => {
    const counts: Partial<Record<AccountLinkId, number | null>> =
      this.panelId === 'admin' ? { manageOrders: this.ordersService.pendingCount() } : {};
    const superAdmin = this.auth.isSuperAdmin();
    const toSidebarLink = (link: AccountLink): SidebarLink => {
      const children = this.childLinks(link.id).map(toSidebarLink);
      return {
        ...link,
        exact: this.panel.exact.includes(link.id),
        count: counts[link.id],
        ...(children.length ? { children } : {}),
      };
    };
    return this.panel.groups
      .filter((group) => !group.superAdmin || superAdmin)
      .map((group) => ({
        label: group.label,
        links: group.links.map((id) =>
          toSidebarLink(this.panel.links.find((l) => l.id === id)!),
        ),
      }));
  });

  // Page shown, named in the top bar: the link its URL starts with (longest first),
  // links opening others aside
  readonly current = computed(() => {
    const path = this.adminView.url().split(/[?#]/)[0];
    return [...this.panel.links]
      .filter((l) => !this.childLinks(l.id).length)
      .sort((a, b) => b.link.length - a.link.length)
      .find((l) => path === l.link || path.startsWith(`${l.link}/`));
  });

  // Link the page shown is listed under, named before it in the top bar
  readonly currentParent = computed(() => {
    const parent = this.current()?.parent;
    return parent ? this.panel.links.find((l) => l.id === parent) : undefined;
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
