import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { EmptyComponent } from '../../../components/empty/empty.component';
import { SellerSummary } from '../../../models/seller.model';
import { MarketplaceService } from '../../../services/marketplace/marketplace.service';
import { AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { toneOf } from '../../../shared/marketplace';
import { PricePipe } from '../../../shared/price.pipe';

type NoticeAt = 'payout' | 'access';

// Admin: one seller's store, reached from the sellers list (and from an approved application):
// their totals, the payouts made to them outside the platform, suspension and deletion
@Component({
    selector: 'app-admin-seller',
    imports: [
        DatePipe,
        FormsModule,
        RouterLink,
        TranslatePipe,
        ButtonModule,
        InputTextModule,
        SkeletonModule,
        TextareaModule,
        EmptyComponent,
        AvatarUrlPipe,
        PricePipe,
    ],
    templateUrl: './admin-seller.component.html',
    styleUrl: './admin-seller.component.scss'
})
export class AdminSellerComponent implements OnInit {
  private marketplace = inject(MarketplaceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly toneOf = toneOf;

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly seller = signal<SellerSummary | null>(null);
  readonly failed = signal(false);
  readonly busy = signal(false);
  // Outcome of the last action, shown in the card it was made from
  readonly notice = signal<{ at: NoticeAt; ok: boolean; text: string } | null>(null);
  suspendReason = '';
  deleteReason = '';
  readonly deleting = signal(false);
  payoutReference = '';
  payoutNote = '';
  readonly payoutOpen = signal(false);

  ngOnInit() {
    if (this.isBrowser) this.load();
  }

  // With the payouts and fresh totals
  load() {
    this.failed.set(false);
    this.marketplace.getSeller(this.id).subscribe({
      next: (seller) => this.seller.set(seller),
      error: () => this.failed.set(true),
    });
  }

  setStatus(status: 'active' | 'suspended') {
    this.run('access', this.marketplace.setSellerStatus(this.id, status, this.suspendReason.trim()), (updated) => {
      this.suspendReason = '';
      this.seller.update((s) => (s ? { ...s, ...updated } : s));
    });
  }

  // Wipes the store and seller access (once paid out): the user is no longer a seller, so back
  // to the list; the ledger and payouts stay
  deleteStore() {
    this.run('access', this.marketplace.deleteStore(this.id, this.deleteReason.trim()), () => {
      this.router.navigate(['/admin/sellers']);
    });
  }

  recordPayout() {
    if (!this.payoutReference.trim()) {
      this.notice.set({ at: 'payout', ok: false, text: this.translate.instant('adminSellers.payout.referenceRequired') });
      return;
    }
    this.run('payout', this.marketplace.recordPayout(this.id, this.payoutReference.trim(), this.payoutNote.trim()), () => {
      this.payoutOpen.set(false);
      this.payoutReference = '';
      this.payoutNote = '';
      this.notice.set({ at: 'payout', ok: true, text: this.translate.instant('adminSellers.payout.recorded') });
      this.load();
    });
  }

  private run<T>(at: NoticeAt, request: Observable<T>, done: (value: T) => void) {
    this.busy.set(true);
    this.notice.set(null);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        done(value);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.notice.set({
          at,
          ok: false,
          text:
            err.error?.code === 'unpaidEarnings'
              ? this.translate.instant('adminSellers.access.unpaidEarnings')
              : err.error?.message || this.translate.instant('adminSellers.actionFailed'),
        });
      },
    });
  }
}
