import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { adminActions } from './config';
import { CartSummaryComponent } from '../cart-summary/cart-summary.component';
import { HeaderAccountComponent } from './header-account/header-account.component';
import { ButtonModule } from 'primeng/button';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    ButtonModule,
    RouterModule,
    CartSummaryComponent,
    HeaderAccountComponent,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  themeService = inject(ThemeService);
  auth = inject(AuthService);

  adminActions = adminActions;
}
