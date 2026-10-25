import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

// Thin gradient bar fixed on top of the page while a route loads (lazy chunks, resolvers, guards).
// Shown on every navigation and kept a moment after the end so instant ones still show it filling.
@Component({
  selector: 'app-route-progress',
  standalone: true,
  template: `<div class="route-progress-bar" [style.transform]="'scaleX(' + progress() / 100 + ')'"></div>`,
  styleUrl: './route-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    'aria-label': 'Page loading',
    '[attr.aria-valuenow]': 'visible() ? progress() : null',
    '[class.visible]': 'visible()',
  },
})
export class RouteProgressComponent {
  readonly progress = signal(0);
  readonly visible = signal(false);

  private hideTimer?: ReturnType<typeof setTimeout>;
  private trickleTimer?: ReturnType<typeof setInterval>;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e instanceof NavigationStart) this.start();
        else if (
          e instanceof NavigationEnd ||
          e instanceof NavigationCancel ||
          e instanceof NavigationError
        )
          this.done();
      });

    inject(DestroyRef).onDestroy(() => this.clearTimers());
  }

  private start() {
    this.clearTimers();
    this.progress.set(20);
    this.visible.set(true);
    // Slows down as it gets closer to 90%, never reaches the end on its own
    this.trickleTimer = setInterval(
      () => this.progress.update((p) => p + (90 - p) * 0.1),
      200,
    );
  }

  private done() {
    this.clearTimers();
    if (!this.visible()) return;
    this.progress.set(100);
    // Let the bar fill (even on instant navigations), then fade it out and reset
    this.hideTimer = setTimeout(() => {
      this.visible.set(false);
      this.hideTimer = setTimeout(() => this.progress.set(0), 300);
    }, 400);
  }

  private clearTimers() {
    clearTimeout(this.hideTimer);
    clearInterval(this.trickleTimer);
  }
}
