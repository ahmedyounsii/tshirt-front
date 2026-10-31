import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Output,
} from '@angular/core';
import { DesignModel } from '../../../../models/design.model';
import { uploadedDesignsService } from '../../../../services/uploaded-designs.service';
import { PanelHeaderComponent } from '../panel-header/panel-header.component';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ACCEPTED_IMAGE_INPUT,
  MAX_FILES_PER_BATCH,
  MAX_UPLOAD_MB,
} from '../../../../shared/image-upload';
import { IconComponent } from '../../../../components/icon/icon.component';

// Files dropped anywhere on the designer (this zone included) are handled by the designer
// page, which shares the uploads, errors and drag state through uploadedDesignsService
@Component({
    selector: 'app-upload-design',
    imports: [IconComponent, TranslatePipe, PanelHeaderComponent],
    templateUrl: './upload-design.component.html',
    styleUrl: './upload-design.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadDesignComponent {
  readonly maxSizeMb = MAX_UPLOAD_MB;
  readonly maxFiles = MAX_FILES_PER_BATCH;
  readonly acceptedTypes = ACCEPTED_IMAGE_INPUT;

  @Output() doUpload = new EventEmitter<DesignModel>();
  @Output() doClose = new EventEmitter<any>();

  private uploads = inject(uploadedDesignsService);
  readonly previousDesigns = this.uploads.uploadedDesigns;
  readonly errors = this.uploads.errors;
  readonly processing = this.uploads.processing;
  readonly dragging = this.uploads.draggingFiles;

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const design of await this.uploads.addFiles(files)) {
      this.doUpload.emit(design);
    }
  }

  selectDesign(design: DesignModel) {
    this.doUpload.emit(design);
  }

  dismissErrors() {
    this.errors.set([]);
  }
}
