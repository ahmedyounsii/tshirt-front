import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SelectComponent } from '../../../components/select/select.component';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { CategoryChipsComponent, ChipItem } from '../../../components/category-chips/category-chips.component';
import { EmptyComponent } from '../../../components/empty/empty.component';
import { SearchInputComponent } from '../../../components/search-input/search-input.component';
import {
  APPLICATION_STATUSES,
  ApplicationDetail,
  ApplicationsPage,
  IssuedCode,
  SellerApplication,
} from '../../../models/seller.model';
import { UserModel } from '../../../models/user.model';
import { ConfirmService } from '../../../services/confirm/confirm.service';
import { LanguageService } from '../../../services/language.service';
import { MarketplaceService } from '../../../services/marketplace/marketplace.service';
import { AvatarUrlPipe } from '../../../shared/avatar-url.pipe';
import { copyText, toneOf } from '../../../shared/marketplace';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';

const PAGE_SIZE = 20;
// Submission date filter, in days (0: any date)
const PERIODS = [0, 7, 30, 90];

type Applicant = Exclude<SellerApplication['user'], string>;

// Admin: seller applications. Search and filter them, open one to read it and approve or
// reject it. Approving makes the activation code, shown here to be copied and sent to the
// applicant (there is no email delivery): it can be shown again, replaced or revoked
@Component({
    selector: 'app-admin-seller-applications',
    imports: [
        DatePipe,
        FormsModule,
        RouterLink,
        TranslatePipe,
        SelectComponent,
        SkeletonComponent,
        CategoryChipsComponent,
        EmptyComponent,
        SearchInputComponent,
        AvatarUrlPipe,
        DialogComponent,
    ],
    templateUrl: './admin-seller-applications.component.html',
    styleUrl: './admin-seller-applications.component.scss'
})
export class AdminSellerApplicationsComponent implements OnInit {
  private marketplace = inject(MarketplaceService);
  private translate = inject(TranslateService);
  private confirm = inject(ConfirmService);
  private language = inject(LanguageService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly toneOf = toneOf;
  // Submission date filter: any date, or the last days
  readonly periodOptions = computed(() => {
    this.language.current();
    return PERIODS.map((days) => ({
      value: days,
      label: this.translate.instant(days ? 'adminSellers.periods.last' : 'adminSellers.periods.any', { days }),
    }));
  });

  readonly page = signal<ApplicationsPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly status = signal('pending');
  readonly search = signal('');
  readonly period = signal(0);
  readonly pageIndex = signal(1);

  readonly chips = computed<ChipItem[]>(() => {
    const counts = this.page()?.counts ?? {};
    return [
      { id: '', label: 'common.all', count: counts.all ?? 0 },
      ...APPLICATION_STATUSES.map((s) => ({
        id: s,
        label: `sellerApply.status.${s}`,
        count: counts[s] ?? 0,
      })),
    ];
  });

  readonly pages = computed(() => {
    const page = this.page();
    return page ? Math.max(1, Math.ceil(page.count / page.size)) : 1;
  });

  // Detail dialog
  readonly detailOpen = signal(false);
  readonly detail = signal<ApplicationDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly rejecting = signal(false);
  rejectReason = '';
  // The code just made or revealed: only kept while the dialog is open
  readonly issued = signal<IssuedCode | null>(null);
  readonly copied = signal<'code' | 'instructions' | null>(null);

  ngOnInit() {
    if (this.isBrowser) this.load();
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    const days = this.period();
    const from = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined;
    this.marketplace
      .getApplications({
        page: this.pageIndex(),
        size: PAGE_SIZE,
        status: this.status(),
        search: this.search(),
        from,
      })
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  onStatus(status: string) {
    this.status.set(status);
    this.pageIndex.set(1);
    this.load();
  }

  onSearch(search: string) {
    this.search.set(search);
    this.pageIndex.set(1);
    this.load();
  }

  onPeriod(days: number) {
    this.period.set(days);
    this.pageIndex.set(1);
    this.load();
  }

  goTo(page: number) {
    this.pageIndex.set(page);
    this.load();
  }

  // Store shown for an application: as it is now once activated (the seller may have changed
  // its name, description or logo), else as it was sent
  storeOf(application: SellerApplication): { name: string; description: string; logo?: string; current: boolean } {
    const store = application.currentStore;
    if (!store) {
      return { name: application.storeName, description: application.description ?? '', logo: application.logo, current: false };
    }
    return {
      name: store.name || application.storeName,
      description: store.description ?? '',
      logo: store.logo,
      current: true,
    };
  }

  applicant(application: SellerApplication): Applicant | null {
    return typeof application.user === 'string' ? null : application.user;
  }

  initials(user: Pick<UserModel, 'name'> | null): string {
    return (user?.name ?? '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  open(application: SellerApplication) {
    this.issued.set(null);
    this.copied.set(null);
    this.actionError.set(null);
    this.rejecting.set(false);
    this.rejectReason = '';
    this.detail.set(null);
    this.detailOpen.set(true);
    this.refreshDetail(application._id);
  }

  private refreshDetail(id: string) {
    this.detailLoading.set(true);
    this.marketplace.getApplication(id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.actionError.set(this.translate.instant('adminSellers.applications.loadFailed'));
      },
    });
  }

  // The code of the application that is still valid, if any
  liveCode = computed(() => this.detail()?.codes.find((c) => c.status === 'unused') ?? null);

  closeDetail(open: boolean) {
    this.detailOpen.set(open);
    // The code never stays on screen once the dialog is closed
    if (!open) this.issued.set(null);
  }

  approve() {
    const application = this.detail()?.application;
    if (!application) return;
    this.run(this.marketplace.approve(application._id), (issued) => {
      this.issued.set({ code: issued.code, info: issued.info });
      this.afterChange(application._id);
    });
  }

  startReject() {
    this.rejecting.set(true);
    this.actionError.set(null);
  }

  reject() {
    const application = this.detail()?.application;
    if (!application) return;
    this.run(this.marketplace.reject(application._id, this.rejectReason.trim()), () => {
      this.rejecting.set(false);
      this.issued.set(null);
      this.afterChange(application._id);
    });
  }

  reveal() {
    const application = this.detail()?.application;
    if (!application) return;
    this.run(this.marketplace.revealCode(application._id), (issued) => this.issued.set(issued));
  }

  async regenerate() {
    const application = this.detail()?.application;
    if (!application) return;
    const ok = await this.confirm.ask({
      header: this.translate.instant('adminSellers.applications.code.regenerateTitle'),
      message: this.translate.instant('adminSellers.applications.code.regenerateText'),
      acceptLabel: this.translate.instant('adminSellers.applications.code.regenerate'),
      acceptIcon: 'pi pi-refresh',
    });
    if (!ok) return;
    this.run(this.marketplace.regenerateCode(application._id), (issued) => {
      this.issued.set(issued);
      this.refreshDetail(application._id);
    });
  }

  async revoke() {
    const application = this.detail()?.application;
    if (!application) return;
    const ok = await this.confirm.ask({
      header: this.translate.instant('adminSellers.applications.code.revokeTitle'),
      message: this.translate.instant('adminSellers.applications.code.revokeText'),
      acceptLabel: this.translate.instant('adminSellers.applications.code.revoke'),
      acceptIcon: 'pi pi-ban',
      severity: 'danger',
    });
    if (!ok) return;
    this.run(this.marketplace.revokeCode(application._id), () => {
      this.issued.set(null);
      this.refreshDetail(application._id);
    });
  }

  // Deletes the application and its codes, then closes the dialog
  async remove() {
    const application = this.detail()?.application;
    if (!application) return;
    const ok = await this.confirm.ask({
      header: this.translate.instant('adminSellers.applications.deleteTitle'),
      message: this.translate.instant('adminSellers.applications.deleteText', { name: application.storeName }),
      acceptLabel: this.translate.instant('common.delete'),
      acceptIcon: 'pi pi-trash',
      severity: 'danger',
    });
    if (!ok) return;
    this.run(this.marketplace.deleteApplication(application._id), () => {
      this.closeDetail(false);
      this.load();
    });
  }

  // Message to send the applicant, with the code and where to enter it
  instructions(code: string): string {
    const application = this.detail()?.application;
    return this.translate.instant('adminSellers.applications.code.instructions', {
      name: this.applicant(application!)?.name ?? '',
      store: application?.storeName ?? '',
      code,
      url: `${window.location.origin}/become-seller`,
      date: this.issued()?.info.expiresAt ? new Date(this.issued()!.info.expiresAt).toLocaleDateString() : '',
    });
  }

  async copy(what: 'code' | 'instructions') {
    const code = this.issued()?.code;
    if (!code) return;
    const ok = await copyText(what === 'code' ? code : this.instructions(code));
    this.copied.set(ok ? what : null);
    if (!ok) this.actionError.set(this.translate.instant('adminSellers.applications.code.copyFailed'));
  }

  // Opens the user's mail app with the instructions; the admin sends it themselves
  mailtoLink(): string | null {
    const code = this.issued()?.code;
    const email = this.applicant(this.detail()?.application ?? ({} as SellerApplication))?.email;
    if (!code || !email) return null;
    const subject = this.translate.instant('adminSellers.applications.code.mailSubject');
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(this.instructions(code))}`;
  }

  private afterChange(id: string) {
    this.refreshDetail(id);
    this.load();
  }

  private run<T>(request: import('rxjs').Observable<T>, done: (value: T) => void) {
    this.busy.set(true);
    this.actionError.set(null);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        done(value);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.actionError.set(err.error?.message || this.translate.instant('adminSellers.applications.actionFailed'));
      },
    });
  }
}
