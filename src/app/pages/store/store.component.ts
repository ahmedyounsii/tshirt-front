import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';
import { HeroCollageComponent } from '../../shared/hero-collage/hero-collage.component';
import { TagComponent } from '../../components/tag/tag.component';
import { IconComponent } from '../../components/icon/icon.component';

const STORE_PERKS = [
  { icon: 'sp-icon sp-star', title: 'store.perks.quality.title', text: 'store.perks.quality.text' },
  { icon: 'sp-icon sp-flash', title: 'store.perks.fast.title', text: 'store.perks.fast.text' },
  { icon: 'sp-icon sp-delivery', title: 'store.perks.shipping.title', text: 'store.perks.shipping.text' },
  { icon: 'sp-icon sp-color-palette', title: 'store.perks.custom.title', text: 'store.perks.custom.text' },
];

// Every product, paginated: opened from the "See more" button of the home carousel
@Component({
    selector: 'app-store',
    imports: [IconComponent, TagComponent, HeroCollageComponent, ProductGalleryComponent, RouterLink, TranslatePipe],
    templateUrl: './store.component.html',
    styleUrl: './store.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoreComponent {
  readonly perks = STORE_PERKS;
  // ?category=<id> opens the store on that category (links of the discount cards)
  readonly category = inject(ActivatedRoute).snapshot.queryParamMap.get('category');

  scrollToCollection(el: HTMLElement) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
