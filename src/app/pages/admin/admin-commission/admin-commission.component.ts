import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CommissionSettings } from '../../../models/seller.model';
import { MarketplaceService } from '../../../services/marketplace/marketplace.service';

// Rate typed in a field: a number between 0 and 100 with 2 decimals at most, else null
const parseRate = (value: string | number | null): number | null => {
  if (value === null || value === '') return null;
  const rate = Number(String(value).replace(',', '.'));
  const twoDecimals = Math.abs(Math.round(rate * 100) - rate * 100) < 1e-9;
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 && twoDecimals ? rate : null;
};

// Admin: the platform commission, one rate for every seller, applied to the orders placed
// after a change
@Component({
    selector: 'app-admin-commission',
    imports: [DatePipe, FormsModule, RouterLink, TranslatePipe, ButtonModule, InputTextModule],
    templateUrl: './admin-commission.component.html',
    styleUrl: './admin-commission.component.scss'
})
export class AdminCommissionComponent implements OnInit {
  private marketplace = inject(MarketplaceService);
  private translate = inject(TranslateService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly settings = signal<CommissionSettings | null>(null);
  defaultRateInput = '';
  readonly savingRate = signal(false);
  readonly rateMessage = signal<{ ok: boolean; text: string } | null>(null);

  ngOnInit() {
    if (this.isBrowser) this.loadSettings();
  }

  loadSettings() {
    this.marketplace.getSettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.defaultRateInput = String(settings.defaultRate);
      },
      error: () => this.rateMessage.set({ ok: false, text: this.translate.instant('adminCommission.loadFailed') }),
    });
  }

  saveDefaultRate() {
    const rate = parseRate(this.defaultRateInput);
    if (rate === null) {
      this.rateMessage.set({ ok: false, text: this.translate.instant('adminCommission.invalid') });
      return;
    }
    this.savingRate.set(true);
    this.rateMessage.set(null);
    this.marketplace.saveDefaultRate(rate).subscribe({
      next: (settings) => {
        this.savingRate.set(false);
        this.settings.set(settings);
        this.rateMessage.set({ ok: true, text: this.translate.instant('adminCommission.saved') });
      },
      error: (err: HttpErrorResponse) => {
        this.savingRate.set(false);
        this.rateMessage.set({ ok: false, text: err.error?.message || this.translate.instant('adminSellers.actionFailed') });
      },
    });
  }
}
