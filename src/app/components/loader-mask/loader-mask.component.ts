import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LogoComponent } from '../logo/logo.component';
import { LogoTextComponent } from '../logo-text/logo-text.component';

// Full-screen splash covering the app while it starts: logo, wordmark and a spinner
@Component({
  selector: 'app-loader-mask',
  standalone: true,
  imports: [LogoComponent, LogoTextComponent, TranslateModule],
  templateUrl: './loader-mask.component.html',
  styleUrl: './loader-mask.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
  },
})
export class LoaderMaskComponent {
  // Shown under the logo in place of the SPELLPRINT wordmark
  readonly text = input<string>();
}
