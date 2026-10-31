import { DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { MyApplication } from '../../models/seller.model';
import { AuthService } from '../../services/auth/auth.service';
import { SellerService } from '../../services/seller/seller.service';
import { ACCEPTED_BANNER_INPUT, IMAGE_REJECTION_KEYS, prepareAvatar } from '../../shared/image-upload';

// Steps shown on top of the page, in order
const STEPS = ['apply', 'review', 'activate', 'sell'] as const;

// Server error codes with their own message (sellerApply.errors.<code>)
const KNOWN_ERRORS = [
  'openApplication',
  'alreadySeller',
  'invalid',
  'used',
  'revoked',
  'expired',
  'tooManyAttempts',
  'notApproved',
];

// The description is optional, like the logo
const DESCRIPTION_MAX = 1000;

// Seller program of the logged-in user, one page for the whole journey: the application
// form (again after a rejection), where it stands while reviewed, the activation code once
// approved, then the way to the seller dashboard. Approval alone grants nothing: the code
// the admin sends is what turns the account into a seller account
@Component({
    selector: 'app-become-seller',
    imports: [
        DatePipe,
        FormsModule,
        RouterLink,
        TranslatePipe,
        SkeletonComponent,
    ],
    templateUrl: './become-seller.component.html',
    styleUrl: './become-seller.component.scss'
})
export class BecomeSellerComponent implements OnInit {
  private sellerService = inject(SellerService);
  private translate = inject(TranslateService);
  readonly auth = inject(AuthService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly steps = STEPS;
  readonly acceptLogo = ACCEPTED_BANNER_INPUT;
  readonly descriptionMax = DESCRIPTION_MAX;

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly state = signal<MyApplication | null>(null);

  // Application form
  form = { storeName: '', description: '', phone: '', link: '' };
  readonly logo = signal<Blob | null>(null);
  readonly logoPreview = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly submitted = signal(false);

  // Activation
  code = '';
  readonly activating = signal(false);
  readonly activateError = signal<string | null>(null);
  readonly activated = signal(false);

  // Where the user stands: "seller" (activated, or suspended), "approved" (code to enter),
  // "pending" (being reviewed) or "form" (no application, or rejected)
  readonly stage = computed(() => {
    const state = this.state();
    const seller = state?.seller ?? this.auth.user()?.seller;
    if (this.auth.hasSellerAccount() || (seller && seller.status !== 'closed')) return 'seller';
    const status = state?.application?.status;
    if (status === 'approved') return 'approved';
    if (status === 'pending') return 'pending';
    return 'form';
  });

  readonly currentStep = computed(() => {
    switch (this.stage()) {
      case 'seller':
        return 3;
      case 'approved':
        return 2;
      case 'pending':
        return 1;
      default:
        return 0;
    }
  });

  readonly rejected = computed(() => this.state()?.application?.status === 'rejected');
  readonly suspended = computed(() => this.auth.user()?.seller?.status === 'suspended');
  // Their previous store was deleted: by them, or by an admin (with the reason)
  readonly closed = computed(() => {
    const seller = this.auth.user()?.seller;
    if (seller?.status !== 'closed') return null;
    return { bySelf: seller.closedBy === this.auth.user()?._id, reason: seller.closedReason };
  });

  ngOnInit() {
    if (this.isBrowser) this.load();
  }

  load() {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.sellerService.getMyApplication().subscribe({
      next: (state) => {
        this.state.set(state);
        // A rejected applicant starts from what they sent
        const previous = state.application;
        if (previous?.status === 'rejected') {
          this.form = {
            storeName: previous.storeName,
            description: previous.description ?? '',
            phone: previous.phone ?? '',
            link: previous.link ?? '',
          };
        }
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  async onLogo(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const prepared = await prepareAvatar(file);
    if ('error' in prepared) {
      this.formError.set(
        this.translate.instant(IMAGE_REJECTION_KEYS[prepared.error], { name: file.name, size: 10 }),
      );
      return;
    }
    this.formError.set(null);
    this.setLogo(prepared.file);
  }

  removeLogo() {
    this.setLogo(null);
  }

  private setLogo(blob: Blob | null) {
    const previous = this.logoPreview();
    if (previous) URL.revokeObjectURL(previous);
    this.logo.set(blob);
    this.logoPreview.set(blob ? URL.createObjectURL(blob) : null);
  }

  // Same rules as the server, checked first to answer right away
  private validate(): string | null {
    const name = this.form.storeName.trim();
    const description = this.form.description.trim();
    if (name.length < 2 || name.length > 60) return 'sellerApply.errors.storeName';
    if (description.length > DESCRIPTION_MAX) return 'sellerApply.errors.description';
    const link = this.form.link.trim();
    if (link && !/^https?:\/\/\S+$/i.test(link)) return 'sellerApply.errors.link';
    return null;
  }

  submit() {
    const invalid = this.validate();
    if (invalid) {
      this.formError.set(this.translate.instant(invalid));
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.sellerService
      .apply(
        {
          storeName: this.form.storeName.trim(),
          description: this.form.description.trim() || undefined,
          phone: this.form.phone.trim() || undefined,
          link: this.form.link.trim() || undefined,
        },
        this.logo(),
      )
      .subscribe({
        next: (application) => {
          this.submitting.set(false);
          this.submitted.set(true);
          this.setLogo(null);
          this.state.update((state) => ({
            application,
            code: null,
            seller: state?.seller ?? null,
          }));
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.formError.set(this.errorMessage(err));
        },
      });
  }

  activate() {
    if (!this.code.trim()) return;
    this.activating.set(true);
    this.activateError.set(null);
    this.sellerService.activate(this.code).subscribe({
      next: ({ application }) => {
        this.activating.set(false);
        this.activated.set(true);
        this.code = '';
        this.state.update((state) => ({ application, code: state?.code ?? null, seller: null }));
      },
      error: (err: HttpErrorResponse) => {
        this.activating.set(false);
        this.activateError.set(this.errorMessage(err));
      },
    });
  }

  private errorMessage(err: HttpErrorResponse): string {
    const code = err.error?.code;
    if (KNOWN_ERRORS.includes(code)) return this.translate.instant(`sellerApply.errors.${code}`);
    if (err.status === 400 && err.error?.message) return err.error.message;
    return this.translate.instant('sellerApply.errors.generic');
  }
}
