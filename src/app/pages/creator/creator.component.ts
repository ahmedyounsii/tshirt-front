import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map, Subscription } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { EmptyComponent } from '../../components/empty/empty.component';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';
import { ProfileCollectionsComponent } from '../../components/profile-collections/profile-collections.component';
import {
  profileTab,
  ProfileTabsComponent,
} from '../../components/profile-tabs/profile-tabs.component';
import { CreatorProfile } from '../../models/user.model';
import { UsersService } from '../../services/users/users.service';
import { AuthService } from '../../services/auth/auth.service';
import { LanguageService } from '../../services/language.service';
import { SeoService } from '../../services/seo.service';
import { AvatarUrlPipe } from '../../shared/avatar-url.pipe';

// Public store of a creator (/store/<username>), opened from their name on a
// product card: identity and totals like the user's own profile, then their products
// or their published collections, one tab each
@Component({
  selector: 'app-creator',
  standalone: true,
  imports: [
    TranslatePipe,
    AvatarUrlPipe,
    SkeletonModule,
    EmptyComponent,
    ProductGalleryComponent,
    ProfileTabsComponent,
    ProfileCollectionsComponent,
  ],
  templateUrl: './creator.component.html',
  // Same header as the logged in user's profile
  styleUrl: '../profile/profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatorComponent {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private usersService = inject(UsersService);
  private auth = inject(AuthService);
  private language = inject(LanguageService);
  private seo = inject(SeoService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly creator = signal<CreatorProfile | null>(null);
  // Starts true so the server render shows the skeleton, not "not found"
  readonly loading = signal(true);
  // Products or collections, from "?tab="
  readonly tab = toSignal(
    this.route.queryParamMap.pipe(map((params) => profileTab(params.get('tab')))),
    { initialValue: 'products' as const },
  );

  initials = computed(() => {
    const creator = this.creator();
    if (!creator) return '';
    return (creator.name || creator.username || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  });

  // The name, "@username" when the account has no name
  handle = computed(() => {
    const creator = this.creator();
    if (!creator) return '';
    return creator.name || (creator.username ? `@${creator.username}` : '');
  });

  // e.g. "October 2026", in the UI language
  memberSince = computed(() => {
    const createdAt = this.creator()?.createdAt;
    const time = createdAt ? Date.parse(createdAt) : NaN;
    if (Number.isNaN(time)) return '';
    return new Intl.DateTimeFormat(this.language.current(), {
      month: 'long',
      year: 'numeric',
    }).format(time);
  });

  private request?: Subscription;

  constructor() {
    // The API is only reachable from the browser. The page is reused from one
    // creator to the next, so it follows the handle
    if (this.isBrowser) {
      this.route.paramMap
        .pipe(takeUntilDestroyed())
        .subscribe((params) => this.load(params.get('handle') ?? ''));
    }
    // After the SeoService's own update, which resets the page's tags
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.applySeo());
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  private load(handle: string): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.request = this.usersService.getCreator(handle).subscribe({
      next: (creator) => {
        // Their own public store: the logged in user gets their store page instead
        if (creator._id === this.auth.user()?._id) {
          this.router.navigate(['/my_store'], { replaceUrl: true });
          return;
        }
        this.creator.set(creator);
        this.loading.set(false);
        this.applySeo();
      },
      error: (err) => {
        if (err?.status !== 404) console.error('Failed to load the creator', err);
        this.creator.set(null);
        this.loading.set(false);
      },
    });
  }

  private applySeo(): void {
    if (!this.creator()) return;
    const params = { name: this.handle() };
    this.seo.setPage({
      title: this.translate.instant('creatorPage.seoTitle', params),
      description: this.translate.instant('creatorPage.seoDescription', params),
    });
  }
}
