import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { AuditEntry, AuditPage } from '../../../models/seller.model';
import { MarketplaceService } from '../../../services/marketplace/marketplace.service';
import { ConfirmService } from '../../../services/confirm/confirm.service';

const PAGE_SIZE = 20;

// Admin: the audit log of the sensitive marketplace actions (commission, sellers, applications,
// payouts), newest first. Entries can be deleted one by one or all at once
@Component({
    selector: 'app-admin-audit',
    imports: [DatePipe, TranslatePipe, SkeletonComponent],
    templateUrl: './admin-audit.component.html',
    styleUrl: './admin-audit.component.scss'
})
export class AdminAuditComponent implements OnInit {
  private marketplace = inject(MarketplaceService);
  private translate = inject(TranslateService);
  private confirm = inject(ConfirmService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly page = signal<AuditPage | null>(null);
  readonly pageIndex = signal(1);
  readonly error = signal<string | null>(null);

  readonly pages = computed(() => {
    const page = this.page();
    return page ? Math.max(1, Math.ceil(page.count / page.size)) : 1;
  });

  ngOnInit() {
    if (this.isBrowser) this.load();
  }

  load() {
    this.error.set(null);
    this.marketplace.getAudit({ page: this.pageIndex(), size: PAGE_SIZE }).subscribe({
      next: (page) => this.page.set(page),
      error: () => this.error.set(this.translate.instant('adminAudit.loadFailed')),
    });
  }

  goTo(page: number) {
    this.pageIndex.set(page);
    this.load();
  }

  async deleteEntry(entry: AuditEntry) {
    const ok = await this.confirm.ask({
      header: this.translate.instant('adminAudit.deleteEntryTitle'),
      message: this.translate.instant('adminAudit.deleteEntryText', { action: this.actionLabel(entry.action) }),
      acceptLabel: this.translate.instant('common.delete'),
      acceptIcon: 'pi pi-trash',
      severity: 'danger',
    });
    if (!ok) return;
    this.marketplace.deleteAuditEntry(entry._id).subscribe({
      next: () => {
        // The last entry of a page gone: back one page
        const page = this.page();
        if (page && page.items.length === 1 && this.pageIndex() > 1) this.pageIndex.update((p) => p - 1);
        this.load();
      },
      error: () => this.error.set(this.translate.instant('adminAudit.actionFailed')),
    });
  }

  async clear() {
    const ok = await this.confirm.ask({
      header: this.translate.instant('adminAudit.clearTitle'),
      message: this.translate.instant('adminAudit.clearText'),
      acceptLabel: this.translate.instant('adminAudit.clear'),
      acceptIcon: 'pi pi-trash',
      severity: 'danger',
    });
    if (!ok) return;
    this.marketplace.clearAudit().subscribe({
      next: () => {
        this.pageIndex.set(1);
        this.load();
      },
      error: () => this.error.set(this.translate.instant('adminAudit.actionFailed')),
    });
  }

  // "commission.default" -> its translated label
  actionLabel(action: string): string {
    const key = `adminAudit.actions.${action}`;
    const label = this.translate.instant(key);
    return label === key ? action : label;
  }

  details(details?: Record<string, unknown>): string {
    if (!details) return '';
    const parts: string[] = [];
    // Rate changes; null was a seller following the default rate (entries from before every
    // seller had the default one)
    if ('from' in details || 'to' in details) {
      const rate = (v: unknown) => (v === null || v === undefined ? this.translate.instant('adminAudit.default') : `${v}%`);
      parts.push(`${rate(details['from'])} → ${rate(details['to'])}`);
    }
    if (details['reason']) parts.push(String(details['reason']));
    if (details['reference']) parts.push(String(details['reference']));
    if (typeof details['amountCents'] === 'number') parts.push(`${(details['amountCents'] as number) / 100}`);
    if (details['code']) parts.push(`…${details['code']}`);
    if (details['storeName']) parts.push(String(details['storeName']));
    if (details['store']) parts.push(String(details['store']));
    if (typeof details['count'] === 'number') {
      parts.push(this.translate.instant('adminAudit.removed', { count: details['count'] }));
    }
    if (typeof details['quantity'] === 'number') parts.push(`×${details['quantity']}`);
    return parts.join(' · ');
  }
}
