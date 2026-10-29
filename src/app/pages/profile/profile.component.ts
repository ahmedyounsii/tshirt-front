import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';
import { ProfileCollectionsComponent } from '../../components/profile-collections/profile-collections.component';
import { ProfileDesignsComponent } from '../../components/profile-designs/profile-designs.component';
import {
  profileTab,
  ProfileTabsComponent,
} from '../../components/profile-tabs/profile-tabs.component';
import { AuthService } from '../../services/auth/auth.service';
import { ProductsService } from '../../services/products/products.service';
import { CollectionsService } from '../../services/collections/collections.service';
import { LanguageService } from '../../services/language.service';
import { UsersService } from '../../services/users/users.service';
import {
  ACCEPTED_IMAGE_INPUT,
  IMAGE_REJECTION_KEYS,
  MAX_UPLOAD_MB,
  prepareAvatar,
} from '../../shared/image-upload';
import { USER_PICS } from '../../shared/user-pics';
import { AvatarUrlPipe } from '../../shared/avatar-url.pipe';
import { UserModel } from '../../models/user.model';

// Profile of the logged in user, Instagram like: identity and totals, then the
// products they saved, the designs they shared or their collections, one tab each
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    TranslatePipe,
    NgTemplateOutlet,
    RouterLink,
    ButtonModule,
    SkeletonModule,
    DialogComponent,
    AvatarUrlPipe,
    ProductGalleryComponent,
    ProfileTabsComponent,
    ProfileCollectionsComponent,
    ProfileDesignsComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  auth = inject(AuthService);
  private productsService = inject(ProductsService);
  private collectionsService = inject(CollectionsService);
  private language = inject(LanguageService);
  private usersService = inject(UsersService);
  private translate = inject(TranslateService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarInput');
  readonly acceptedImages = ACCEPTED_IMAGE_INPUT;
  readonly userPics = USER_PICS;
  avatarDialogOpen = signal(false);
  // Picked in the dialog, saved with its "Save" button (null: nothing picked yet)
  pendingAvatar = signal<string | null>(null);
  // The user's own photo, a tile before the ready-made ones: their current one (server
  // path), or one just picked (blob: preview url and the file to upload on save)
  uploadedPhoto = signal<{ url: string; file?: Blob } | null>(null);
  // Photo being prepared, or the picture being saved or removed
  savingAvatar = signal(false);
  avatarError = signal('');

  selectedAvatar = computed(() => this.pendingAvatar() ?? this.auth.user()?.avatar);
  avatarChanged = computed(() => {
    const pending = this.pendingAvatar();
    return pending !== null && pending !== this.auth.user()?.avatar;
  });

  // Products, designs or collections, from "?tab="
  readonly tab = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => profileTab(params.get('tab')))),
    { initialValue: 'products' as const },
  );

  // Null while loading
  productCount = signal<number | null>(null);
  // Drafts included, like the collections tab
  collectionCount = signal<number | null>(null);

  initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    return (user.name || user.username || user.email)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  });

  // The name, "@username" when the account has no name
  handle = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    return user.name || (user.username ? `@${user.username}` : '');
  });

  // e.g. "October 2026", in the UI language
  memberSince = computed(() => {
    const createdAt = this.auth.user()?.createdAt;
    const time = createdAt ? Date.parse(createdAt) : NaN;
    if (Number.isNaN(time)) return '';
    return new Intl.DateTimeFormat(this.language.current(), {
      month: 'long',
      year: 'numeric',
    }).format(time);
  });

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.loadStats();
    this.collectionsService.getCollections('mine').subscribe({
      next: (collections) => this.collectionCount.set(collections.length),
      error: () => this.collectionCount.set(0),
    });
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.discardPreview());
  }

  // A ready-made picture, an uploaded photo, or back to the initials
  openAvatarDialog() {
    const current = this.auth.user()?.avatar;
    this.discardPreview();
    this.avatarError.set('');
    this.pendingAvatar.set(null);
    this.uploadedPhoto.set(current?.startsWith('/uploads/') ? { url: current } : null);
    this.avatarDialogOpen.set(true);
  }

  choosePic(avatar: string) {
    this.avatarError.set('');
    this.pendingAvatar.set(avatar);
  }

  // A photo just picked is uploaded; anything else is already a path
  saveAvatar() {
    const avatar = this.pendingAvatar();
    if (!avatar) return;
    const photo = this.uploadedPhoto();
    this.send(
      photo?.file && photo.url === avatar
        ? this.usersService.uploadAvatar(photo.file)
        : this.usersService.updateAvatar(avatar),
    );
  }

  removeAvatar() {
    this.send(this.usersService.removeAvatar());
  }

  pickAvatar() {
    this.avatarInput()?.nativeElement.click();
  }

  async onAvatarPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Picking the same file again must fire "change" again
    input.value = '';
    if (!file) return;

    this.avatarError.set('');
    this.savingAvatar.set(true);
    const prepared = await prepareAvatar(file);
    if ('error' in prepared) {
      this.savingAvatar.set(false);
      this.avatarError.set(
        this.translate.instant(IMAGE_REJECTION_KEYS[prepared.error], {
          name: file.name,
          size: MAX_UPLOAD_MB,
        }),
      );
      return;
    }
    this.savingAvatar.set(false);
    this.discardPreview();
    const url = URL.createObjectURL(prepared.file);
    this.uploadedPhoto.set({ url, file: prepared.file });
    this.pendingAvatar.set(url);
  }

  private discardPreview() {
    const photo = this.uploadedPhoto();
    if (photo?.file) URL.revokeObjectURL(photo.url);
  }

  private send(request: Observable<UserModel>) {
    this.avatarError.set('');
    this.savingAvatar.set(true);
    request.subscribe({
      next: (user) => {
        this.auth.setUser(user);
        this.savingAvatar.set(false);
        this.avatarDialogOpen.set(false);
      },
      error: () => {
        this.avatarError.set(this.translate.instant('profile.photoError'));
        this.savingAvatar.set(false);
      },
    });
  }

  // Total without any filter: a one item page carries it
  loadStats() {
    this.productsService.getProductsPage({ mine: true, page: 1, size: 1 }).subscribe({
      next: (data) => this.productCount.set(data.counts?.['all'] ?? data.count),
      error: () => this.productCount.set(0),
    });
  }
}
