import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  CollectionModel,
  CollectionTextKey,
  collectionLink,
  localized,
} from '../../models/collection.model';
import { creatorDisplayName, creatorLink } from '../../models/user.model';
import { LanguageService } from '../../services/language.service';
import { PreviewService } from '../../services/preview/preview.service';
import { TagComponent } from '../../components/tag/tag.component';
import { DiscountsService } from '../../services/discounts/discounts.service';
import { CollectionSaleComponent } from '../collection-sale/collection-sale.component';

const pad = (n: number) => String(n).padStart(2, '0');
// Horizontal drag, in px, that turns the page on touch screens
const SWIPE_DISTANCE = 48;
// Products a collection needs for the thumbnail rail to show
const MIN_THUMBS_PRODUCTS = 4;

// Selling points under the text, the same for every collection
const PERKS = [
  { icon: 'pi pi-print', label: 'collectionShowcase.perks.onDemand' },
  { icon: 'pi pi-truck', label: 'collectionShowcase.perks.delivery' },
  { icon: 'pi pi-wallet', label: 'collectionShowcase.perks.cashOnDelivery' },
];

// A collection with the look of the home showcases: text on the left, the picked
// piece big on a stage, the first pieces in a thumbnail rail.
// Texts and products come from the collection made in the admin.
@Component({
    selector: 'app-collection-showcase',
    imports: [TagComponent, TranslatePipe, RouterLink, CollectionSaleComponent],
    templateUrl: './collection-showcase.component.html',
    styleUrl: './collection-showcase.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionShowcaseComponent {
  readonly collection = input.required<CollectionModel>();
  // 1 when the showcase holds the page's main heading
  readonly headingLevel = input<1 | 2>(2);
  // Loads the big picture first: set it when the showcase is at the top of the page
  readonly priority = input(false);
  // Main button goes to the collection's own page (off it), else to the store
  readonly showPageLink = input(false);
  // Second button goes to the collections list (off it), else to the designer
  readonly showCollectionsLink = input(true);
  // Pieces shown, the first ones of the collection: the rest are on its page
  readonly limit = input(3);
  // Stage on the left and text on the right (desktop only, phones keep text first)
  readonly reverse = input(false);
  // Collection editor preview: the links are shown but not followed
  readonly editing = input(false);

  private language = inject(LanguageService);
  private previewer = inject(PreviewService);
  private discounts = inject(DiscountsService);

  readonly perks = PERKS;
  readonly active = signal(0);

  readonly items = computed(() => {
    console.log(this.collection().products);
    console.log(this.limit());

    return this.collection().products.slice(0, this.limit() + 1);
  });
  // undefined while the collection has no products
  readonly current = computed(() => this.items()[this.active()]);
  readonly pageLink = computed(() => collectionLink(this.collection()));
  // A live discount is made on the collection: tagged next to its eyebrow
  readonly onSale = computed(() => !!this.discounts.collectionSale(this.collection()._id));
  readonly titleId = computed(() => `${this.collection().slug}-showcase-title`);
  // "01 / 03" counter of the stage
  readonly position = computed(() => pad(this.active() + 1));
  readonly total = computed(() => pad(this.items().length));
  // Small collections show the big picture alone, the arrows still page through it
  readonly showThumbs = computed(
    () => this.collection().products.length >= MIN_THUMBS_PRODUCTS,
  );
  // Who made the collection, like on the product cards (their open store's name, else
  // their username): none for the shop's own (admins)
  readonly ownerName = computed(() => {
    const owner = this.collection().createdBy;
    if (!owner || owner.role === 'admin') return null;
    return creatorDisplayName(owner) || null;
  });
  // Their store (the user's own store page for their own collections)
  readonly ownerLink = computed(() => {
    const owner = this.collection().createdBy;
    if (!owner) return null;
    return creatorLink(owner);
  });

  // A text of the collection in the current language
  text(key: CollectionTextKey): string {
    return localized(this.collection()[key], this.language.current());
  }

  private thumbs = viewChild<ElementRef<HTMLElement>>('thumbs');
  private swipeFrom: number | null = null;
  // Set by a swipe that turned the page, so the click ending it doesn't open the preview
  private swiped = false;

  select(index: number, focus = false): void {
    const n = this.items().length;
    if (!n) return;
    const next = (index + n) % n;
    this.active.set(next);
    if (!focus) return;
    const thumbs =
      this.thumbs()?.nativeElement.querySelectorAll<HTMLElement>(
        '.stage-thumb',
      );
    thumbs?.[next]?.focus();
  }

  step(delta: number): void {
    this.select(this.active() + delta);
  }

  // Arrow keys move along the thumbnails, like tabs (rail on desktop, row on phones)
  onThumbsKey(event: KeyboardEvent): void {
    const moves: Record<string, number> = {
      ArrowUp: this.active() - 1,
      ArrowLeft: this.active() - 1,
      ArrowDown: this.active() + 1,
      ArrowRight: this.active() + 1,
      Home: 0,
      End: this.items().length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    this.select(moves[event.key], true);
  }

  // Full screen preview of the picked piece, like in the store: can be turned in 3D
  // (its capture is the texture) and shows its back when it has one
  preview(): void {
    const item = this.current();
    if (this.swiped || !item) return;
    this.previewer.open(item);
  }

  onSwipeStart(event: PointerEvent): void {
    this.swiped = false;
    this.swipeFrom = event.pointerType === 'mouse' ? null : event.clientX;
  }

  onSwipeEnd(event: PointerEvent): void {
    if (this.swipeFrom === null) return;
    const distance = event.clientX - this.swipeFrom;
    this.swipeFrom = null;
    if (Math.abs(distance) < SWIPE_DISTANCE) return;
    this.swiped = true;
    this.step(distance < 0 ? 1 : -1);
  }
}
