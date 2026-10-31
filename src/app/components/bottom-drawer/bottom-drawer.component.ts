import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
  Signal,
  DOCUMENT
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const MOBILE_QUERY = '(max-width: 900px)';

export const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

// Live mobile breakpoint, false on the server. Call it in an injection context
export function injectIsMobile(): Signal<boolean> {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return signal(false);
  const query = window.matchMedia(MOBILE_QUERY);
  const mobile = signal(query.matches);
  const onChange = (e: MediaQueryListEvent) => mobile.set(e.matches);
  query.addEventListener('change', onChange);
  inject(DestroyRef).onDestroy(() =>
    query.removeEventListener('change', onChange),
  );
  return mobile.asReadonly();
}

// Shown drawers, last one on top: only the top one reacts to Escape
const openDrawers: BottomDrawerComponent[] = [];
// Body scroll stays locked while at least one drawer asks for it
let scrollLocks = 0;

// Native-like bottom sheet: slides up, drags down to close, closes on backdrop and Escape.
// Mount it with @if and unmount it on (doClose); call close() to dismiss it with the animation.
// Slots: [drawerHeader] (sticks above the body, also a drag area), default body, [drawerFooter].
@Component({
  selector: 'app-bottom-drawer',
  standalone: true,
  templateUrl: './bottom-drawer.component.html',
  styleUrl: './bottom-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.mobile-only]': 'mobileOnly()',
    '[class.closing]': 'closing()',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class BottomDrawerComponent implements OnInit, OnDestroy {
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private isMobile = injectIsMobile();

  // When true, the drawer only applies on mobile and renders its content inline on desktop
  mobileOnly = input(false);
  closeOnEscape = input(true);
  blockScroll = input(true);
  ariaLabel = input<string | null>(null);

  doClose = output<void>();

  // False when rendered inline (mobileOnly on desktop)
  readonly asDrawer = computed(() => !this.mobileOnly() || this.isMobile());

  // Closing plays the slide-down animation before emitting
  readonly closing = signal(false);
  readonly dragOffset = signal(0);
  private dragStartY: number | null = null;

  private static readonly CLOSE_ANIMATION_MS = 250;
  private static readonly DRAG_CLOSE_THRESHOLD = 100;

  constructor() {
    effect((onCleanup) => {
      if (!this.isBrowser || !this.asDrawer() || !this.blockScroll()) return;
      if (scrollLocks++ === 0) this.document.body.style.overflow = 'hidden';
      onCleanup(() => {
        if (--scrollLocks === 0) this.document.body.style.overflow = '';
      });
    });
  }

  ngOnInit() {
    openDrawers.push(this);
  }

  ngOnDestroy() {
    openDrawers.splice(openDrawers.indexOf(this), 1);
  }

  close() {
    if (this.closing()) return;
    if (!this.asDrawer()) {
      this.doClose.emit();
      return;
    }
    this.closing.set(true);
    setTimeout(
      () => this.doClose.emit(),
      BottomDrawerComponent.CLOSE_ANIMATION_MS,
    );
  }

  onEscape() {
    if (!this.closeOnEscape() || !this.asDrawer()) return;
    const top = openDrawers.filter((d) => d.asDrawer()).at(-1);
    if (top === this) this.close();
  }

  onDragStart(event: PointerEvent) {
    // Controls in the header keep their own clicks
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea')) return;
    this.dragStartY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onDragMove(event: PointerEvent) {
    if (this.dragStartY === null) return;
    // Only allow dragging down
    this.dragOffset.set(Math.max(event.clientY - this.dragStartY, 0));
  }

  onDragEnd() {
    if (this.dragStartY === null) return;
    const shouldClose =
      this.dragOffset() > BottomDrawerComponent.DRAG_CLOSE_THRESHOLD;
    this.dragStartY = null;
    this.dragOffset.set(0);
    if (shouldClose) this.close();
  }
}
