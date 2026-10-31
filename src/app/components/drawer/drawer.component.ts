import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
  DOCUMENT
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

// Shown drawers, last one on top: only the top one reacts to Escape
const openDrawers: DrawerComponent[] = [];
// Body scroll stays locked while at least one drawer asks for it
let scrollLocks = 0;

// Side drawer: slides in from the left or right, closes on its close button, backdrop and Escape.
// Mount it with @if and unmount it on (doClose); call close() to dismiss it with the animation.
// Slots: [drawerHeader] (next to the close button), default body, [drawerFooter] (sticks under the body).
@Component({
  selector: 'app-drawer',
  imports: [TranslatePipe],
  templateUrl: './drawer.component.html',
  styleUrl: './drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.left]': "position() === 'left'",
    '[class.closing]': 'closing()',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class DrawerComponent implements OnInit, OnDestroy {
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  position = input<'left' | 'right'>('right');
  closeOnEscape = input(true);
  blockScroll = input(true);
  ariaLabel = input<string | null>(null);

  doClose = output<void>();

  // Closing plays the slide-out animation before emitting
  readonly closing = signal(false);
  private panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  // Focus goes back to the opener once closed
  private opener: HTMLElement | null = null;

  private static readonly CLOSE_ANIMATION_MS = 250;

  constructor() {
    effect((onCleanup) => {
      if (!this.isBrowser || !this.blockScroll()) return;
      if (scrollLocks++ === 0) this.document.body.style.overflow = 'hidden';
      onCleanup(() => {
        if (--scrollLocks === 0) this.document.body.style.overflow = '';
      });
    });
    afterNextRender(() => {
      this.opener = this.document.activeElement as HTMLElement | null;
      this.panel().nativeElement.focus({ preventScroll: true });
    });
  }

  ngOnInit() {
    openDrawers.push(this);
  }

  ngOnDestroy() {
    openDrawers.splice(openDrawers.indexOf(this), 1);
    this.opener?.focus?.({ preventScroll: true });
  }

  close() {
    if (this.closing()) return;
    this.closing.set(true);
    setTimeout(() => this.doClose.emit(), DrawerComponent.CLOSE_ANIMATION_MS);
  }

  onEscape() {
    if (this.closeOnEscape() && openDrawers.at(-1) === this) this.close();
  }
}
