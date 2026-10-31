import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
import { ToggleSwitchComponent } from '../../components/toggleswitch/toggleswitch.component';
import { EmptyComponent } from '../../components/empty/empty.component';
import { TagComponent } from '../../components/tag/tag.component';
import { CategoriesService } from '../../services/categories/categories.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { DiscountsService } from '../../services/discounts/discounts.service';
import { LanguageService } from '../../services/language.service';
import { localized } from '../../models/collection.model';
import {
  discountBadge,
  DiscountModel,
  DiscountStatus,
  discountStatus,
  DISCOUNT_STATUS_TAG,
  DISCOUNT_STATUSES,
  DISCOUNT_TARGET_ICONS,
} from '../../models/discount.model';
import { formatWhen, relativeTime } from '../../shared/discount-dates';

type Filter = DiscountStatus | 'all';

// Statuses refresh on their own while the page is open
const TICK_MS = 30_000;
// Targets named on a card, the others are counted
const SHOWN_TARGETS = 3;

// Admin: the global discounts, with their status and schedule; paused, edited or deleted from here.
// Every user (admins included) gets the same page for their user discounts (/my-discounts)
@Component({
    selector: 'app-manage-discounts',
    imports: [
        TranslatePipe,
        DecimalPipe,
        FormsModule,
        RouterLink,
        SkeletonComponent,
        ToggleSwitchComponent,
        EmptyComponent,
        TagComponent,
    ],
    templateUrl: './manage-discounts.component.html',
    styleUrl: './manage-discounts.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManageDiscountsComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private discountsService = inject(DiscountsService);
  private categoriesService = inject(CategoriesService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ticker?: ReturnType<typeof setInterval>;

  // Only the logged in user's discounts, under /my-discounts
  readonly mine = !!this.route.snapshot.data['mine'];
  // The seller dashboard mounts the same pages under its own URL (route data.base)
  readonly base: string =
    this.route.snapshot.data['base'] ?? (this.mine ? '/my-discounts' : '/admin/discounts');

  readonly statusTag = DISCOUNT_STATUS_TAG;
  readonly badge = discountBadge;
  readonly targetIcons = DISCOUNT_TARGET_ICONS;

  readonly discounts = signal<DiscountModel[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly filter = signal<Filter>('all');
  // Category labels by id, to name the targets
  readonly categoryLabels = signal<Map<string, string>>(new Map());
  // Discount being paused/resumed or deleted: its controls are disabled meanwhile
  readonly busyId = signal<string | null>(null);
  readonly now = signal(Date.now());

  // Per status, "all" for the total
  readonly counts = computed(() => {
    const counts: Record<Filter, number> = { all: 0, live: 0, scheduled: 0, paused: 0, ended: 0 };
    for (const discount of this.discounts()) {
      counts[this.status(discount)]++;
      counts.all++;
    }
    return counts;
  });

  readonly filters = computed(() =>
    (['all', ...DISCOUNT_STATUSES] as Filter[]).map((id) => ({ id, count: this.counts()[id] })),
  );

  readonly shown = computed(() => {
    const filter = this.filter();
    const list = this.discounts();
    return filter === 'all' ? list : list.filter((d) => this.status(d) === filter);
  });

  ngOnInit(): void {
    this.load();
    this.categoriesService.getAllCategories().subscribe({
      next: (categories) =>
        this.categoryLabels.set(new Map(categories.map((c) => [c._id, c.label]))),
      error: (err) => console.error('Failed to load categories', err),
    });
    if (this.isBrowser) this.ticker = setInterval(() => this.now.set(Date.now()), TICK_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.discountsService.getDiscounts(this.mine).subscribe({
      next: (discounts) => {
        this.discounts.set(discounts);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load discounts', err);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  // Follows the clock, not only what the server said when the page loaded
  status(discount: DiscountModel): DiscountStatus {
    return discountStatus(discount, this.now());
  }

  title(discount: DiscountModel): string {
    return localized(discount.title, this.language.current());
  }

  targetNames(discount: DiscountModel): string[] {
    if (discount.target === 'collections') return discount.collections.map((c) => c.name);
    if (discount.target === 'products') return discount.products.map((p) => p.label);
    return discount.categories.map((id) => this.categoryLabels().get(id) ?? '…');
  }

  shownTargets(discount: DiscountModel): string[] {
    return this.targetNames(discount).slice(0, SHOWN_TARGETS);
  }

  moreTargets(discount: DiscountModel): number {
    return Math.max(0, this.targetNames(discount).length - SHOWN_TARGETS);
  }

  when(date: string | null): string {
    return date ? formatWhen(date, this.language.current()) : '';
  }

  // Time gone of a live discount with an end, in %
  progress(discount: DiscountModel): number | null {
    if (this.status(discount) !== 'live' || !discount.endsAt) return null;
    const start = new Date(discount.startsAt ?? discount.createdAt ?? Date.now()).getTime();
    const end = new Date(discount.endsAt).getTime();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((this.now() - start) / (end - start)) * 100));
  }

  // "Ends in 3 days", "Starts in 2 hours", "Ended 4 days ago"...
  timing(discount: DiscountModel): string {
    const lang = this.language.current();
    const status = this.status(discount);
    const t = (key: string, when: string) =>
      this.translate.instant(`manageDiscounts.timing.${key}`, { when });
    if (status === 'scheduled') return t('starts', relativeTime(discount.startsAt!, lang, this.now()));
    if (status === 'ended') return t('ended', relativeTime(discount.endsAt!, lang, this.now()));
    if (status === 'live') {
      return discount.endsAt
        ? t('ends', relativeTime(discount.endsAt, lang, this.now()))
        : this.translate.instant('manageDiscounts.timing.noEnd');
    }
    return this.translate.instant('manageDiscounts.timing.paused');
  }

  setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  toggle(discount: DiscountModel, enabled: boolean): void {
    if (this.busyId()) return;
    this.busyId.set(discount._id);
    this.discountsService.setEnabled(discount._id, enabled).subscribe({
      next: (saved) => {
        this.busyId.set(null);
        this.replace(saved);
      },
      error: (err) => {
        console.error('Failed to update the discount', err);
        this.busyId.set(null);
        // The switch goes back to what is saved
        this.discounts.update((list) => [...list]);
        alert(this.translate.instant('manageDiscounts.toggleFailed'));
      },
    });
  }

  // Orders already placed keep the price they were charged
  async remove(discount: DiscountModel): Promise<void> {
    if (this.busyId()) return;
    const ok = await this.confirm.confirmDelete(
      this.translate.instant('manageDiscounts.deleteMessage', { name: discount.name }),
      this.translate.instant('manageDiscounts.deleteHeader'),
    );
    if (!ok) return;

    this.busyId.set(discount._id);
    this.discountsService.deleteDiscount(discount._id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.discounts.update((list) => list.filter((d) => d._id !== discount._id));
      },
      error: (err) => {
        console.error('Failed to delete the discount', err);
        this.busyId.set(null);
        alert(this.translate.instant('manageDiscounts.deleteFailed'));
      },
    });
  }

  private replace(saved: DiscountModel): void {
    this.discounts.update((list) => list.map((d) => (d._id === saved._id ? saved : d)));
  }
}
