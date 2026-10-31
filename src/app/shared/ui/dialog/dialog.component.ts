import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  model,
  PLATFORM_ID,
  viewChild,
  DOCUMENT
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

let nextId = 0;

// Modal on the native <dialog>: top layer, focus trap and Escape come from the browser.
// Bind [(open)]; closes on the close button, Escape and a backdrop click.
// Slots: default body, [dialogHeader] (next to the title), [dialogFooter] (sticks under the body,
// .dialog-actions lines buttons up on the right).
// Selects and other overlays inside: [appendTo]="dialog.overlayHost()" on <app-dialog #dialog>.
@Component({
    selector: 'app-dialog',
    imports: [TranslatePipe],
    templateUrl: './dialog.component.html',
    styleUrl: './dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogComponent {
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  open = model(false);
  header = input<string | null>(null);
  // False while saving: Escape, the backdrop and the close button do nothing
  closable = input(true);
  dismissableMask = input(true);
  // Max width, narrowed to the screen with a 12px margin on each side
  width = input('480px');

  readonly titleId = `app-dialog-title-${nextId++}`;
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private overlayHostRef = viewChild.required<ElementRef<HTMLElement>>('overlayHost');
  // A drag that starts in the panel and ends on the backdrop must not close it
  private pressedBackdrop = false;

  constructor() {
    effect((onCleanup) => {
      if (!this.isBrowser) return;
      const el = this.dialog().nativeElement;
      if (!this.open()) {
        if (el.open) el.close();
        return;
      }
      if (!el.open) el.showModal();
      // The page can't scroll while open: one shift keeps the overlays aligned
      const win = this.document.defaultView!;
      this.overlayHostRef().nativeElement.style.translate = `${-win.scrollX}px ${-win.scrollY}px`;
      const body = this.document.body;
      const overflow = body.style.overflow;
      body.style.overflow = 'hidden';
      onCleanup(() => (body.style.overflow = overflow));
    });
  }

  overlayHost(): HTMLElement {
    return this.overlayHostRef().nativeElement;
  }

  close() {
    if (this.closable()) this.open.set(false);
  }

  // Escape: the browser would close it on its own, keep the open state in charge
  onCancel(event: Event) {
    event.preventDefault();
    this.close();
  }

  onPointerDown(event: PointerEvent) {
    this.pressedBackdrop = event.target === this.dialog().nativeElement;
  }

  onClick(event: MouseEvent) {
    const onBackdrop = event.target === this.dialog().nativeElement;
    if (onBackdrop && this.pressedBackdrop && this.dismissableMask()) this.close();
    this.pressedBackdrop = false;
  }
}
