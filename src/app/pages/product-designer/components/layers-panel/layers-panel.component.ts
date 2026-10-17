import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { designObject } from '../../../../models/design-object.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// Layers of the current side, top of the list is the front-most design.
// Rows are reordered by dragging their handle (pointer events, so it works on touch too)
@Component({
  selector: 'app-layers-panel',
  standalone: true,
  imports: [TranslatePipe, ButtonModule],
  templateUrl: './layers-panel.component.html',
  styleUrl: './layers-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayersPanelComponent implements OnChanges {
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private host = inject(ElementRef<HTMLElement>);

  // Back to front, like they are rendered on the canvas
  @Input({ required: true }) designs: designObject[] = [];
  @Input() selectedId: string | null = null;

  // Emits the new back to front order
  @Output() doReorder = new EventEmitter<designObject[]>();
  @Output() doSelect = new EventEmitter<designObject>();
  @Output() doRemove = new EventEmitter<designObject>();

  // Front to back, as displayed
  layers: designObject[] = [];
  draggingId: string | null = null;

  ngOnChanges(): void {
    if (!this.draggingId) this.layers = [...this.designs].reverse();
  }

  title(layer: designObject): string {
    if (layer.type === 'text') return (
        layer.text?.content.trim() || this.translate.instant('common.text')
      );
    return layer.design?.label || this.translate.instant('common.graphic');
  }

  subtitle(layer: designObject): string {
    if (layer.type === 'text' && layer.text) {
      const font = layer.text.fontFamily.split(',')[0].replace(/['"]/g, '');
      return this.translate.instant('designer.textLayer', {
        font,
        size: Math.round(layer.text.fontSize),
      });
    }
    // Uploads stay local (no id) until the product is saved
    return this.translate.instant(
      layer.design && !layer.design._id ? 'common.upload' : 'common.graphic',
    );
  }

  startDrag(layer: designObject, event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    this.draggingId = layer.id;

    const move = (e: PointerEvent) => this.dragOver(layer, e.clientY);
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      this.draggingId = null;
      const order = [...this.layers].reverse();
      if (order.some((d, i) => d !== this.designs[i])) {
        this.doReorder.emit(order);
      }
      this.cdr.detectChanges();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    this.cdr.detectChanges();
  }

  // Moves the dragged row to the slot under the pointer
  private dragOver(layer: designObject, clientY: number) {
    const rows: HTMLElement[] = Array.from(
      this.host.nativeElement.querySelectorAll('.layer'),
    );
    let target = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    if (target === -1) target = rows.length;
    const from = this.layers.indexOf(layer);
    // Removing the row first shifts the slots after it
    if (target > from) target--;
    if (target === from) return;
    const layers = [...this.layers];
    layers.splice(from, 1);
    layers.splice(target, 0, layer);
    this.layers = layers;
    this.cdr.detectChanges();
  }

  remove(layer: designObject, event: MouseEvent) {
    event.stopPropagation();
    this.doRemove.emit(layer);
  }
}
