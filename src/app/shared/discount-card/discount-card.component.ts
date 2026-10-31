import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  discountBadge,
  DiscountCardData,
  discountLink,
  salePrice,
} from '../../models/discount.model';
import { localized } from '../../models/collection.model';
import { DiscountsService } from '../../services/discounts/discounts.service';
import { LanguageService } from '../../services/language.service';
import { TagComponent } from '../../components/tag/tag.component';
import { PricePipe } from '../price.pipe';
import { formatWhen } from '../discount-dates';

type CountdownUnit = { key: 'days' | 'hours' | 'minutes' | 'seconds'; value: string };

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Time each product stays in the window
const AUTOPLAY_SECONDS = 5;

const pad = (value: number) => String(value).padStart(2, '0');

// Card of a discount on the home page: the offer on a price sticker, a countdown to its end (or
// to its start when it is announced), then its products in a shop window, playing one after the
// other, each under a hang tag with its price before and after the discount. Also the live
// preview of the admin editor
@Component({
    selector: 'app-discount-card',
    imports: [RouterLink, TranslatePipe, TagComponent, PricePipe],
    templateUrl: './discount-card.component.html',
    styleUrl: './discount-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiscountCardComponent implements OnInit, OnDestroy {
  private discounts = inject(DiscountsService);
  private language = inject(LanguageService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ticker?: ReturnType<typeof setInterval>;
  // The discount was fetched again once its countdown ran out
  private refreshed = false;

  readonly discount = input.required<DiscountCardData>();
  // Admin editor: the link is not followed, the discount is not fetched again
  readonly preview = input(false);

  readonly now = signal(this.discounts.now());

  readonly scheduled = computed(() => this.discount().status === 'scheduled');
  readonly badge = computed(() => discountBadge(this.discount()));
  readonly link = computed(() => discountLink(this.discount()));

  readonly title = computed(() => localized(this.discount().title, this.language.current()));
  readonly subtitle = computed(() =>
    localized(this.discount().subtitle, this.language.current()),
  );
  // Collections named in the default title
  readonly names = computed(() =>
    this.discount()
      .collections.map((c) => c.name)
      .join(', '),
  );

  // Products pictured on the right, the one shown picked with the arrows or thumbnails
  readonly previews = computed(() => this.discount().previews);
  readonly active = signal(0);
  // Kept in range when the products change (editor preview)
  readonly index = computed(() => Math.min(this.active(), Math.max(0, this.previews().length - 1)));
  readonly current = computed(() => this.previews()[this.index()] ?? null);

  // Hang tag of the product shown; null when it is not for sale
  readonly prices = computed(() => {
    const price = this.current()?.price;
    return price == null ? null : { original: price, sale: salePrice(price, this.discount()) };
  });

  // "lun. 2 nov., 00:00": when it ends, or starts when announced
  readonly when = computed(() => {
    const { startsAt, endsAt } = this.discount();
    const date = this.scheduled() ? startsAt : endsAt;
    return date ? formatWhen(date, this.language.current()) : null;
  });

  // 1 or -1: the side the next product comes in from
  readonly direction = signal(1);

  step(delta: number): void {
    const count = this.previews().length;
    if (!count) return;
    this.direction.set(delta < 0 ? -1 : 1);
    this.active.set((this.index() + delta + count) % count);
    this.shown = 0;
  }

  // Autoplay: the next product every few seconds, paused while the window is pointed at or
  // focused, off for visitors who prefer less motion
  readonly paused = signal(false);
  private shown = 0;
  private readonly stillMotion =
    this.isBrowser && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private autoplay(): void {
    if (this.stillMotion || this.paused() || this.previews().length < 2) return;
    if (++this.shown >= AUTOPLAY_SECONDS) this.step(1);
  }

  // Swiping the product on touch screens shows the previous or next one
  private swipeX: number | null = null;
  private swiped = false;

  swipeStart(event: PointerEvent): void {
    this.swiped = false;
    this.swipeX = event.pointerType === 'mouse' ? null : event.clientX;
  }

  swipeEnd(event: PointerEvent): void {
    if (this.swipeX == null) return;
    const dx = event.clientX - this.swipeX;
    this.swipeX = null;
    if (Math.abs(dx) < 40 || this.previews().length < 2) return;
    this.swiped = true;
    this.step(dx < 0 ? 1 : -1);
  }

  swipeCancel(): void {
    this.swipeX = null;
  }

  // The tap ending a swipe does not open the product
  openGuard(event: Event): void {
    if (this.swiped) event.preventDefault();
    this.swiped = false;
  }

  // Counting down to the start of an announced discount, else to its end
  private readonly target = computed(() => {
    const { startsAt, endsAt } = this.discount();
    const date = this.scheduled() ? startsAt : endsAt;
    return date ? new Date(date).getTime() : null;
  });

  readonly countdown = computed<CountdownUnit[] | null>(() => {
    const target = this.target();
    if (target == null) return null;
    const left = Math.max(0, target - this.now());
    const days = Math.floor(left / DAY);
    const units: CountdownUnit[] = [
      { key: 'hours', value: pad(Math.floor((left % DAY) / HOUR)) },
      { key: 'minutes', value: pad(Math.floor((left % HOUR) / MINUTE)) },
      { key: 'seconds', value: pad(Math.floor((left % MINUTE) / SECOND)) },
    ];
    return days ? [{ key: 'days', value: pad(days) }, ...units] : units;
  });

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.ticker = setInterval(() => {
      this.now.set(this.discounts.now());
      this.autoplay();
      const target = this.target();
      // Started or ended: prices and cards change, the server tells how
      if (!this.preview() && !this.refreshed && target != null && target <= this.now()) {
        this.refreshed = true;
        this.discounts.reload();
      }
    }, SECOND);
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
  }
}
