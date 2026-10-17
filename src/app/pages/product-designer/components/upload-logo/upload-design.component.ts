import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  inject,
  Output,
} from '@angular/core';
import { DesignModel } from '../../../../models/design.model';
import { uploadedDesignsService } from '../../../../services/uploaded-designs.service';
import { PanelHeaderComponent } from '../panel-header/panel-header.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-upload-design',
  standalone: true,
  imports: [TranslatePipe, PanelHeaderComponent],
  templateUrl: './upload-design.component.html',
  styleUrl: './upload-design.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadDesignComponent {
  readonly maxSizeMb = 10;
  readonly acceptedTypes = 'image/png,image/jpeg,image/svg+xml';

  previousDesigns: DesignModel[] = [];
  dragging = false;
  error = '';

  @Output() doUpload = new EventEmitter<DesignModel>();
  @Output() doClose = new EventEmitter<any>();

  private uploadedDesignsService = inject(uploadedDesignsService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  constructor() {
    effect(() => {
      this.previousDesigns = this.uploadedDesignsService.uploadedDesigns();
      this.cdr.detectChanges();
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.addFile(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging = true;
  }

  onDragLeave(event: DragEvent) {
    // Ignore leaving towards a child of the drop zone
    const target = event.currentTarget as HTMLElement;
    if (target.contains(event.relatedTarget as Node)) return;
    this.dragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.addFile(file);
  }

  selectDesign(design: DesignModel) {
    this.doUpload.emit(design);
  }

  private addFile(file: File) {
    if (!this.acceptedTypes.split(',').includes(file.type)) {
      this.error = this.translate.instant('designer.unsupportedType');
      this.cdr.detectChanges();
      return;
    }
    if (file.size > this.maxSizeMb * 1024 * 1024) {
      this.error = this.translate.instant('designer.tooLarge', {
        size: this.maxSizeMb,
      });
      this.cdr.detectChanges();
      return;
    }
    this.error = '';

    // Kept local until the product is saved, then stored in the backend
    const newDesign: DesignModel = {
      url: URL.createObjectURL(file),
      label: file.name.replace(/\.[^.]+$/, ''),
    };
    this.uploadedDesignsService.uploadedDesigns.update((values) => [
      ...values,
      newDesign,
    ]);
    this.doUpload.emit(newDesign);
  }
}
