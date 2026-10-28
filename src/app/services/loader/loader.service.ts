import { computed, Injectable, signal } from '@angular/core';

// Full screen loader mask, rendered once in the app root. Calls are counted: the mask stays
// while any show() is still waiting for its hide(), so overlapping loads don't cut each other off.
@Injectable({ providedIn: 'root' })
export class LoaderService {
  // The startup mask is the app root's own (see AppComponent.booting)
  private readonly pending = signal(0);
  readonly visible = computed(() => this.pending() > 0);

  show() {
    this.pending.update((n) => n + 1);
  }

  hide() {
    this.pending.update((n) => Math.max(0, n - 1));
  }

  // Shows the mask until the task settles: await loader.during(this.orders.save(order))
  async during<T>(task: Promise<T>): Promise<T> {
    this.show();
    try {
      return await task;
    } finally {
      this.hide();
    }
  }
}
