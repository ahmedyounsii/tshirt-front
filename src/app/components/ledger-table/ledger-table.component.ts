import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LedgerEntry } from '../../models/seller.model';
import { toneOf } from '../../shared/marketplace';
import { PricePipe } from '../../shared/price.pipe';

// Commission ledger lines: what each seller item (or refund of one) was worth, the rate it was
// charged at the time, the platform's share and the seller's. Reversals show negative amounts
@Component({
  selector: 'app-ledger-table',
  standalone: true,
  imports: [DatePipe, TranslatePipe, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ledger-table.component.html',
  styleUrl: './ledger-table.component.scss',
})
export class LedgerTableComponent {
  readonly entries = input.required<LedgerEntry[]>();
  // Admin: the seller of each line
  readonly showSeller = input(false);

  readonly toneOf = toneOf;

  sellerName(entry: LedgerEntry): string {
    return typeof entry.seller === 'string' ? '' : entry.seller?.name ?? '';
  }

  // "refund:2" -> refund, "cancel:1" -> cancel
  reasonOf(entry: LedgerEntry): string {
    return (entry.reason ?? '').split(':')[0] || 'refund';
  }
}
