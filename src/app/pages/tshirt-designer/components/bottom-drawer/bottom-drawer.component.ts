import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  inject,
  Input,
  Output,
} from '@angular/core';

export const MOBILE_QUERY = '(max-width: 900px)';

export const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

@Component({
  selector: 'app-bottom-drawer',
  standalone: true,
  templateUrl: './bottom-drawer.component.html',
  styleUrl: './bottom-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomDrawerComponent {
  private cdr = inject(ChangeDetectorRef);

  // When true, the drawer only applies on mobile and renders its content inline on desktop
  @HostBinding('class.mobile-only') @Input() mobileOnly = false;

  @Output() doClose = new EventEmitter<void>();

  // Closing plays the slide-down animation before emitting
  @HostBinding('class.closing') closing = false;
  dragOffset = 0;
  private dragStartY: number | null = null;

  private static readonly CLOSE_ANIMATION_MS = 250;
  private static readonly DRAG_CLOSE_THRESHOLD = 100;

  close() {
    if (this.closing) return;
    if (this.mobileOnly && !isMobile()) {
      this.doClose.emit();
      return;
    }
    this.closing = true;
    this.cdr.detectChanges();
    setTimeout(
      () => this.doClose.emit(),
      BottomDrawerComponent.CLOSE_ANIMATION_MS,
    );
  }

  onDragStart(event: PointerEvent) {
    this.dragStartY = event.clientY;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  onDragMove(event: PointerEvent) {
    if (this.dragStartY === null) return;
    // Only allow dragging down
    this.dragOffset = Math.max(event.clientY - this.dragStartY, 0);
    this.cdr.detectChanges();
  }

  onDragEnd() {
    if (this.dragStartY === null) return;
    const shouldClose =
      this.dragOffset > BottomDrawerComponent.DRAG_CLOSE_THRESHOLD;
    this.dragStartY = null;
    this.dragOffset = 0;
    if (shouldClose) this.close();
    else this.cdr.detectChanges();
  }
}
