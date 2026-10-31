import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Injector,
  Input,
  Output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

// Minimum distance to the viewport edges
const EDGE = 8;

// Floating panel opened at a trigger: toggle($event) from the trigger's click (or toggle(element)
// to open it at another element), hide() from an action.
// Rendered in the browser top layer (native popover), so no overflow / transform / z-index of an
// ancestor clips it, while its content keeps the styles of the component that declares it.
// Closes on outside click, Escape and resize; follows the trigger on scroll.
// Padding can be overridden by the parent: --popover-padding
@Component({
    selector: 'app-popover',
    templateUrl: './popover.component.html',
    styleUrl: './popover.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverComponent {
  private document = inject(DOCUMENT);
  private injector = inject(Injector);

  // Space between the trigger and the panel
  @Input() offset = 10;
  // At least as wide as the trigger (dropdowns)
  @Input() matchWidth = false;
  // Focuses the first focusable element of the content when shown
  @Input() autoFocus = true;
  @Output() closed = new EventEmitter<void>();

  readonly open = signal(false);
  readonly positioned = signal(false);
  private panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private anchor: HTMLElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.removeListeners());
  }

  toggle(trigger: Event | HTMLElement) {
    if (this.open()) this.hide();
    else this.show(trigger);
  }

  show(trigger: Event | HTMLElement) {
    this.anchor =
      trigger instanceof Event
        ? ((trigger.currentTarget ?? trigger.target) as HTMLElement | null)
        : trigger;
    if (!this.anchor) return;
    this.open.set(true);
    this.positioned.set(false);
    const panel = this.panel().nativeElement;
    panel.style.minWidth = this.matchWidth ? `${this.anchor.offsetWidth}px` : '';
    panel.showPopover?.();
    this.addListeners();
    // Measured once the content is rendered
    afterNextRender(
      () => {
        if (!this.open()) return;
        this.position();
        this.positioned.set(true);
        if (this.autoFocus) this.focusFirst();
      },
      { injector: this.injector },
    );
  }

  hide() {
    if (!this.open()) return;
    this.open.set(false);
    this.panel().nativeElement.hidePopover?.();
    this.removeListeners();
    this.closed.emit();
  }

  // Below the trigger, aligned on its start; above when it doesn't fit below; kept inside the viewport
  private position() {
    if (!this.anchor) return;
    const panel = this.panel().nativeElement;
    const target = this.anchor.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const view = this.document.documentElement;
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const gap = this.offset;

    const fitsBelow = target.bottom + gap + height <= vh - EDGE;
    const fitsAbove = target.top - gap - height >= EDGE;
    const top = fitsBelow || !fitsAbove ? target.bottom + gap : target.top - gap - height;
    const left = Math.min(Math.max(EDGE, target.left), vw - width - EDGE);

    panel.style.top = `${Math.max(EDGE, top)}px`;
    panel.style.left = `${Math.max(EDGE, left)}px`;
  }

  private focusFirst() {
    const focusable = this.panel().nativeElement.querySelector<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus({ preventScroll: true });
  }

  // Outside the panel and the trigger (the trigger toggles by itself)
  private onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node;
    if (this.panel().nativeElement.contains(target) || this.anchor?.contains(target)) return;
    this.hide();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    // Only the popover closes, not a dialog around it
    event.preventDefault();
    const anchor = this.anchor;
    this.hide();
    anchor?.focus();
  };

  private onScroll = () => this.position();
  private onResize = () => this.hide();

  private addListeners() {
    this.document.addEventListener('pointerdown', this.onPointerDown, true);
    this.document.addEventListener('keydown', this.onKeyDown);
    this.document.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    this.document.defaultView?.addEventListener('resize', this.onResize);
  }

  private removeListeners() {
    this.document.removeEventListener('pointerdown', this.onPointerDown, true);
    this.document.removeEventListener('keydown', this.onKeyDown);
    this.document.removeEventListener('scroll', this.onScroll, true);
    this.document.defaultView?.removeEventListener('resize', this.onResize);
  }
}
