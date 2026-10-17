import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DesignsService } from '../../../../services/designs/design.service';
import { DesignCategoryModel } from '../../../../models/design-catergory.model';
import { ImagePickerComponent } from '../image-picker/image-picker.component';
import { AdminToast } from '../admin-toast/admin-toast.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-upload-form',
  standalone: true,
  imports: [TranslatePipe, FormsModule, ButtonModule, InputTextModule, SelectModule, ImagePickerComponent],
  templateUrl: './upload-form.component.html',
  styleUrl: './upload-form.component.scss',
})
export class UploadFormComponent {
  private designsService = inject(DesignsService);
  private translate = inject(TranslateService);

  @Input() categories: DesignCategoryModel[] = [];
  @Input() categoryId = '';
  @Output() categoryIdChange = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();
  // Emits the category the design was uploaded to
  @Output() uploaded = new EventEmitter<string>();
  @Output() notify = new EventEmitter<AdminToast>();

  file: File | null = null;
  label = '';
  uploading = false;

  get canUpload(): boolean {
    return !!this.file && !!this.categoryId && !this.uploading;
  }

  onFileChange(file: File | null) {
    this.file = file;
    if (file && !this.label) {
      this.label = file.name.replace(/\.[^.]+$/, '');
    }
  }

  onCategoryChange(id: string) {
    this.categoryId = id;
    this.categoryIdChange.emit(id);
  }

  upload() {
    if (!this.canUpload || !this.file) return;
    const formData = new FormData();
    formData.append('file', this.file);
    formData.append('label', this.label.trim());
    formData.append('categoryId', this.categoryId);

    this.uploading = true;
    this.designsService.addDesign(formData).subscribe({
      next: () => {
        this.uploading = false;
        this.notify.emit({ type: 'success', message: this.translate.instant('admin.uploaded') });
        this.uploaded.emit(this.categoryId);
      },
      error: () => {
        this.uploading = false;
        this.notify.emit({ type: 'error', message: this.translate.instant('admin.uploadFailed') });
      },
    });
  }
}
