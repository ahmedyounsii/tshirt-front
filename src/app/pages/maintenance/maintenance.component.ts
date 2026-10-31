
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  DOCUMENT
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LogoTextComponent } from '../../components/logo-text/logo-text.component';
import { AuthService } from '../../services/auth/auth.service';
import { LanguageService } from '../../services/language.service';
import { ThemeService } from '../../services/theme.service';

// Full screen page shown while the shop is down (the header is hidden on it, see app.component.html):
// what is happening and a retry that reloads the site. A discreet link gets admins back
// in: the login, or out of a customer account first (the login sends logged in users away)
@Component({
    selector: 'app-maintenance',
    imports: [TranslatePipe, LogoTextComponent],
    templateUrl: './maintenance.component.html',
    styleUrl: './maintenance.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaintenanceComponent {
  private document = inject(DOCUMENT);
  auth = inject(AuthService);
  language = inject(LanguageService);
  theme = inject(ThemeService);

  year = new Date().getFullYear();
  retrying = signal(false);
  // The session lives in localStorage: the admin link waits for the browser so the
  // prerendered page (logged out) still matches the first render
  showAdminLink = signal(false);

  constructor() {
    afterNextRender(() => this.showAdminLink.set(true));
  }

  toggleLanguage() {
    this.language.use(this.language.current() === 'fr' ? 'en' : 'fr');
  }

  // Full reload of the home page: it asks the server again instead of the cached app
  retry() {
    this.retrying.set(true);
    this.document.location.assign('/');
  }

  switchAccount() {
    this.auth.logout('/auth');
  }
}
