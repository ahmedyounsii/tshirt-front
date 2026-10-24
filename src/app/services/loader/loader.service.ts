import { computed, Injectable, signal } from '@angular/core';

// Full screen loader mask, rendered once in the app root. Calls are counted: the mask stays
// while any show() is still waiting for its hide(), so overlapping loads don't cut each other off.
@Injectable({ providedIn: 'root' })
export class LoaderService {
  // Starts at 1: the mask covers the app on startup until the app root hides it
  private readonly pending = signal(1);
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
