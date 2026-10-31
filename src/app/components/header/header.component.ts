import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { navLinks } from './config';
import { CartSummaryComponent } from '../cart-summary/cart-summary.component';
import { HeaderAccountComponent } from './header-account/header-account.component';
import { HeaderViewSwitchComponent } from './header-view-switch/header-view-switch.component';
import { HeaderThemeComponent } from './header-theme/header-theme.component';
import { HeaderLanguageComponent } from './header-language/header-language.component';
import { HeaderSellerComponent } from './header-seller/header-seller.component';
import { TranslatePipe } from '@ngx-translate/core';
import { LogoTextComponent } from '../logo-text/logo-text.component';
import { LogoComponent } from '../logo/logo.component';

@Component({
    selector: 'app-header',
    imports: [
        TranslatePipe,
        RouterModule,
        CartSummaryComponent,
        HeaderAccountComponent,
        HeaderViewSwitchComponent,
        HeaderSellerComponent,
        HeaderThemeComponent,
        HeaderLanguageComponent,
        LogoTextComponent,
        LogoComponent,
    ],
    host: { '(document:keydown.escape)': 'menuOpen.set(false)' },
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss'
})
export class HeaderComponent {
  navLinks = navLinks;

  // Nav panel of small screens
  menuOpen = signal(false);
}
