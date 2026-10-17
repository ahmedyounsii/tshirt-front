import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

const toProduct = (name: string) => ({
  id: name,
  url: `./assets/images/tshirts/${name}.png`,
});
// Static tees of the mosaic (public/assets/images/tshirts): no API call
const SHOWCASE_FEATURED = toProduct('design_5');
// Tees cycling through the 2 small tiles on the right
const SHOWCASE_ROTATION = ['tshirt_02', 'design_2', 'design_3', 'design_4'].map(
  toProduct,
);
// Fixed text of the showcase
const SHOWCASE_COPY = {
  title: 'showcaseProduct.title',
  description: 'showcaseProduct.description',
};
// Selling points listed under the text
const SHOWCASE_PERKS = [
  { icon: 'pi pi-box', label: 'showcaseProduct.perks.preview3d' },
  { icon: 'pi pi-sync', label: 'showcaseProduct.perks.frontBack' },
  { icon: 'pi pi-check-circle', label: 'showcaseProduct.perks.madeToOrder' },
];
// Time each pair of small tees stays on screen
const SHOWCASE_INTERVAL_MS = 5000;

// Home teaser: one big featured tee, 2 small tees on its right that change on a timer, display only
@Component({
  selector: 'app-showcase-product',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './showcase-product.component.html',
  styleUrl: './showcase-product.component.scss',
})
export class ShowcaseProductComponent {
  readonly copy = SHOWCASE_COPY;
  readonly perks = SHOWCASE_PERKS;
  readonly featured = SHOWCASE_FEATURED;

  private readonly tick = signal(0);

  // One tee per small tile; the tile's @for tracks the tee so its image fades in on each change
  readonly tiles = computed(() => {
    const n = SHOWCASE_ROTATION.length;
    const start = this.tick() * 2;
    return [0, 1].map((slot) => [SHOWCASE_ROTATION[(start + slot) % n]]);
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Browser only: no timer during SSR
    afterNextRender(() => {
      const timer = setInterval(
        () => this.tick.update((t) => t + 1),
        SHOWCASE_INTERVAL_MS,
      );
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }
}
