import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  NgZone,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TagComponent } from '../tag/tag.component';

// Time each product stays on the preview before the next one
const ROTATE_MS = 3500;

// Top of the home page: the page's h1, what the shop does and where, the two ways in
// (designer and store) and the reasons to buy, over the brand wallpaper.
// On the right, a preview styled like the designer cycles through store products.
@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [TagComponent, TranslatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-hero.component.html',
  styleUrl: './home-hero.component.scss',
})
export class HomeHeroComponent {
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  // Reasons to buy under the actions (home.hero.perks.<id>)
  readonly perks = [
    { id: 'preview', icon: 'pi pi-eye' },
    { id: 'print', icon: 'pi pi-print' },
    { id: 'delivery', icon: 'pi pi-truck' },
    { id: 'payment', icon: 'pi pi-wallet' },
  ];

  // Products of the preview (home.hero.showcase.products.<id> names them)
  readonly products = [
    { id: 'dragonBall', url: './assets/hero/dragon-ball.webp' },
    { id: 'gear5', url: './assets/hero/gear-5.webp' },
    { id: 'spiderMan', url: './assets/hero/spider-man.webp' },
  ];

  readonly active = signal(0);

  // Hovering the preview holds the current product
  private paused = false;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Outside the zone so the app still becomes stable; the signal triggers the render
    const timer = this.zone.runOutsideAngular(() =>
      setInterval(() => {
        if (!this.paused) this.active.update((i) => (i + 1) % this.products.length);
      }, ROTATE_MS),
    );
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  pause(paused: boolean) {
    this.paused = paused;
  }
}
