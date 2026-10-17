import { DOCUMENT } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import type { PrintArea } from '../tshirt-3d-viewer/tshirt-3d-viewer.component';
// Only used inside @defer, so three.js lands in its own lazy chunk
import { Tshirt3dViewerComponent } from '../tshirt-3d-viewer/tshirt-3d-viewer.component';
import {
  designObject,
  DesignSide,
} from '../../models/design-object.model';

// Everything needed to preview one side of the tshirt
export type PreviewView = {
  // 2D capture, null while it's being generated
  preview: string | null;
  templateUrl: string | null;
  designs: designObject[];
  printArea: PrintArea | null;
};

@Component({
  selector: 'app-img-previewer',
  standalone: true,
  imports: [ButtonModule, Tshirt3dViewerComponent],
  templateUrl: './img-previewer.component.html',
  styleUrl: './img-previewer.component.scss',
})
export class ImgPreviewerComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private previousOverflow: string[] = [];

  @Output() doClosePreviewer = new EventEmitter<any>();
  // Plain image preview
  @Input() preview: any = null;
  // Tshirt preview, 3D composed from the template. With a back, both sides can be previewed
  @Input() front: PreviewView | null = null;
  @Input() back: PreviewView | null = null;
  // Side shown first
  @Input() side: DesignSide = 'front';

  readonly sides: { side: DesignSide; label: string }[] = [
    { side: 'front', label: 'Front' },
    { side: 'back', label: 'Back' },
  ];

  // Opens in 2D, 3D on demand
  view3d = false;

  private readonly imageView: PreviewView = {
    preview: null,
    templateUrl: null,
    designs: [],
    printArea: null,
  };

  get view(): PreviewView {
    if (this.side === 'back' && this.back) return this.back;
    if (this.front) return this.front;
    // A plain image is its own 3D texture (already composed, no designs to draw)
    this.imageView.preview = this.preview;
    this.imageView.templateUrl = this.preview;
    return this.imageView;
  }

  get show3d(): boolean {
    return !!this.view.templateUrl && this.view3d;
  }

  // Block the page scroll behind the overlay while it's open
  private get scrollRoots(): HTMLElement[] {
    return [this.document.documentElement, this.document.body];
  }

  ngOnInit() {
    this.previousOverflow = this.scrollRoots.map((el) => el.style.overflow);
    this.scrollRoots.forEach((el) => (el.style.overflow = 'hidden'));
  }

  ngOnDestroy() {
    this.scrollRoots.forEach(
      (el, i) => (el.style.overflow = this.previousOverflow[i]),
    );
  }

  zoomLevel = 1; // Default zoom level
  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 0.1, 3); // Limit max zoom
  }

  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel - 0.1, 0.1); // Limit min zoom
  }
}
