import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  inject,
  Output,
} from '@angular/core';
import { FileUploadModule } from 'primeng/fileupload';
import { DesignsDisplayerComponent } from '../designs-displayer/designs-displayer.component';
import { DesignModel } from '../../../../models/design.model';
import { uploadedDesignsService } from '../../../../services/uploaded-designs.service';
import { designObject } from '../../../../models/design-object.model';

@Component({
  selector: 'app-upload-design',
  standalone: true,
  imports: [FileUploadModule, DesignsDisplayerComponent],
  templateUrl: './upload-design.component.html',
  styleUrl: './upload-design.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadDesignComponent {
  previewUrl: string | null = null;
  imageBlob: Blob | null = null;
  previousDesigns: DesignModel[] = [];

  @Output() doUpload = new EventEmitter<any>();
  @Output() doClose = new EventEmitter<any>();

  private uploadedDesignsService = inject(uploadedDesignsService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    effect(() => {
      this.previousDesigns = this.uploadedDesignsService.uploadedDesigns();
      this.cdr.detectChanges();
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.imageBlob = new Blob([file], { type: file.type });
      this.previewUrl = URL.createObjectURL(this.imageBlob);
      const newLogo = {
        url: this.previewUrl,
      };
      this.uploadedDesignsService.uploadedDesigns.update((values) => {
        return [...values, newLogo];
      });

      this.doUpload.emit(this.previewUrl);
    }
  }

  selectDesign(design: DesignModel) {
    this.doUpload.emit(design.url);
  }
}
