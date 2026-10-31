import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  signal,
  ViewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { designObject } from '../../models/design-object.model';
import {
  PrintArea,
  ProductComposer,
} from '../product-3d-viewer/compose-product';
import { downloadCanvas } from '../../shared/download-canvas';

// Long side of the canvas: sharp enough when the preview is zoomed
const CANVAS_SIZE = 2048;

// 2D preview drawn on a canvas: shown instantly, no DOM capture needed
@Component({
    selector: 'app-product-2d-viewer',
    imports: [TranslatePipe],
    templateUrl: './product-2d-viewer.component.html',
    styleUrl: './product-2d-viewer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Product2dViewerComponent implements OnChanges {
  @ViewChild('canvasRef', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() templateUrl = '';
  @Input() designs: designObject[] = [];
  @Input() printArea: PrintArea | null = null;

  // True until the first draw is done
  loading = signal(true);

  private composer = new ProductComposer();
  private drawToken = 0;
  private ready = false;

  constructor() {
    // Canvas drawing only exists in the browser (the app is also rendered on the server)
    afterNextRender(() => {
      this.ready = true;
      this.redraw();
    });
  }

  ngOnChanges(): void {
    if (this.ready) this.redraw();
  }

  // Saves the composed product at full canvas resolution, as a transparent PNG
  downloadPng(fileName = 'product-2d.png') {
    if (this.loading()) return;
    downloadCanvas(this.canvasRef.nativeElement, fileName);
  }

  private async redraw() {
    if (!this.templateUrl) return;
    const token = ++this.drawToken;
    try {
      const base = await this.composer.compose(
        this.canvasRef.nativeElement,
        {
          templateUrl: this.templateUrl,
          designs: this.designs,
          printArea: this.printArea,
        },
        CANVAS_SIZE,
        () => token !== this.drawToken,
      );
      if (base) this.loading.set(false);
    } catch (error) {
      console.error('2D preview failed:', error);
    }
  }
}
