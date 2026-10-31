import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { creatorLink } from '../../../models/user.model';
import { AuthService } from '../../../services/auth/auth.service';
import { StoresService } from '../../../services/stores/stores.service';
import { ConfirmService } from '../../../services/confirm/confirm.service';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { SellerService } from '../../../services/seller/seller.service';
import { avatarUrl } from '../../../shared/avatar-url.pipe';
import { ACCEPTED_BANNER_INPUT, IMAGE_REJECTION_KEYS, prepareAvatar } from '../../../shared/image-upload';

const DESCRIPTION_MAX = 1000;

// Seller: the store's public identity (name, description, logo), pausing it (its products
// leave the shop until it reopens) and deleting it. The role, commission and balances are set
// by the admins, never from here
@Component({
  selector: 'app-seller-store',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    SkeletonModule,
    TextareaModule,
    DialogComponent,
  ],
  templateUrl: './seller-store.component.html',
  styleUrl: './seller-store.component.scss',
})
export class SellerStoreComponent implements OnInit {
  private sellerService = inject(SellerService);
  private translate = inject(TranslateService);
  private auth = inject(AuthService);
  private storesService = inject(StoresService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly acceptLogo = ACCEPTED_BANNER_INPUT;
  readonly descriptionMax = DESCRIPTION_MAX;
  readonly storeLink = creatorLink(this.auth.user() ?? { _id: '' });

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly message = signal<{ ok: boolean; text: string } | null>(null);

  form = { name: '', description: '' };
  // Shown logo: the saved one, a new pick (blob url) or none
  readonly logoUrl = signal<string | null>(null);
  // undefined: unchanged, null: removed, a blob: new
  private logo: Blob | null | undefined = undefined;

  // Store status
  readonly paused = computed(() => !!this.auth.user()?.seller?.paused);
  readonly statusBusy = signal(false);
  readonly statusError = signal<string | null>(null);
  // Store name as saved: typed again to delete the store
  readonly savedName = signal('');
  readonly deleteOpen = signal(false);
  deleteConfirm = '';
  readonly deleteError = signal<string | null>(null);

  ngOnInit() {
    if (!this.isBrowser) return;
    this.sellerService.getStore().subscribe({
      next: (store) => {
        this.form = { name: store.name ?? '', description: store.description ?? '' };
        this.savedName.set(store.name || this.auth.user()?.name || '');
        this.logoUrl.set(store.logo ? avatarUrl(store.logo) : null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.set({ ok: false, text: this.translate.instant('sellerDash.loadFailed') });
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
      this.message.set({
        ok: false,
        text: this.translate.instant(IMAGE_REJECTION_KEYS[prepared.error], { name: file.name, size: 10 }),
      });
      return;
    }
    this.message.set(null);
    this.setLogo(prepared.file);
  }

  removeLogo() {
    this.setLogo(null);
  }

  private setLogo(blob: Blob | null) {
    const previous = this.logoUrl();
    if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
    this.logo = blob;
    this.logoUrl.set(blob ? URL.createObjectURL(blob) : null);
  }

  save() {
    const name = this.form.name.trim();
    if (name.length < 2 || name.length > 60) {
      this.message.set({ ok: false, text: this.translate.instant('sellerApply.errors.storeName') });
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    this.sellerService.saveStore({ name, description: this.form.description.trim() }, this.logo).subscribe({
      next: (store) => {
        this.saving.set(false);
        const user = this.auth.user();
        // The dashboard is only open to active sellers: open unless paused
        if (user) this.storesService.remember(user._id, { ...store, status: user.seller?.paused ? 'paused' : 'active' });
        this.logo = undefined;
        this.logoUrl.set(store.logo ? avatarUrl(store.logo) : null);
        this.savedName.set(store.name ?? name);
        this.message.set({ ok: true, text: this.translate.instant('sellerDash.store.saved') });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.message.set({ ok: false, text: err.error?.message || this.translate.instant('sellerDash.actionFailed') });
      },
    });
  }

  async togglePaused() {
    const pause = !this.paused();
    if (pause) {
      const ok = await this.confirm.ask({
        header: this.translate.instant('sellerDash.store.pauseTitle'),
        message: this.translate.instant('sellerDash.store.pauseText'),
        acceptLabel: this.translate.instant('sellerDash.store.pause'),
        acceptIcon: 'pi pi-pause',
      });
      if (!ok) return;
    }
    this.statusBusy.set(true);
    this.statusError.set(null);
    this.sellerService.setPaused(pause).subscribe({
      next: () => this.statusBusy.set(false),
      error: (err: HttpErrorResponse) => {
        this.statusBusy.set(false);
        this.statusError.set(err.error?.message || this.translate.instant('sellerDash.actionFailed'));
      },
    });
  }

  openDelete() {
    this.deleteConfirm = '';
    this.deleteError.set(null);
    this.deleteOpen.set(true);
  }

  canDelete(): boolean {
    return this.deleteConfirm.trim().toLowerCase() === this.savedName().trim().toLowerCase();
  }

  // Seller access ends: back to the seller program page, which explains it
  deleteStore() {
    if (!this.canDelete()) return;
    this.statusBusy.set(true);
    this.deleteError.set(null);
    this.sellerService.closeStore(this.deleteConfirm).subscribe({
      next: () => {
        this.statusBusy.set(false);
        this.deleteOpen.set(false);
        this.router.navigate(['/become-seller']);
      },
      error: (err: HttpErrorResponse) => {
        this.statusBusy.set(false);
        this.deleteError.set(
          err.error?.code === 'unpaidEarnings'
            ? this.translate.instant('sellerDash.store.unpaidEarnings')
            : err.error?.message || this.translate.instant('sellerDash.actionFailed'),
        );
      },
    });
  }
}
