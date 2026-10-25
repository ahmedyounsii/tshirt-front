import { Component, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { DesignsService } from '../../../../services/designs/design.service';
import { DesignCategoryModel } from '../../../../models/design-catergory.model';
import { ImagePickerComponent } from '../image-picker/image-picker.component';
import { GrungeEditorComponent } from '../grunge-editor/grunge-editor.component';
import { AdminToast } from '../admin-toast/admin-toast.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-upload-form',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    MultiSelectModule,
    ImagePickerComponent,
    GrungeEditorComponent,
  ],
  templateUrl: './upload-form.component.html',
  styleUrl: './upload-form.component.scss',
})
export class UploadFormComponent {
  private designsService = inject(DesignsService);
  private translate = inject(TranslateService);

  @Input() categories: DesignCategoryModel[] = [];
  @Input() categoryIds: string[] = [];
  @Output() categoryIdsChange = new EventEmitter<string[]>();
  @Output() closed = new EventEmitter<void>();
  // Emits the categories the design was uploaded to
  @Output() uploaded = new EventEmitter<string[]>();
  @Output() notify = new EventEmitter<AdminToast>();
  @ViewChild(GrungeEditorComponent) grunge?: GrungeEditorComponent;

  file: File | null = null;
  label = '';
  uploading = false;
  // The grunge edge is being rendered at full size, before the upload
  rendering = false;

  get canUpload(): boolean {
    return !!this.file && !!this.categoryIds.length && !this.uploading;
  }

  onFileChange(file: File | null) {
    this.file = file;
    if (file && !this.label) {
      this.label = file.name.replace(/\.[^.]+$/, '');
    }
  }

  onCategoriesChange(ids: string[]) {
    this.categoryIds = ids;
    this.categoryIdsChange.emit(ids);
  }

  async upload() {
    if (!this.canUpload || !this.file) return;
    this.uploading = this.rendering = true;
    const file = this.grunge ? await this.grunge.exportFile() : this.file;
    this.rendering = false;
    if (!file) {
      this.uploading = false;
      this.notify.emit({ type: 'error', message: this.translate.instant('grunge.tooLarge') });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('label', this.label.trim());
    this.categoryIds.forEach((id) => formData.append('categoryIds', id));

    this.designsService.addDesign(formData).subscribe({
      next: () => {
        this.uploading = false;
        this.notify.emit({ type: 'success', message: this.translate.instant('admin.uploaded') });
        this.uploaded.emit(this.categoryIds);
      },
      error: () => {
        this.uploading = false;
        this.notify.emit({ type: 'error', message: this.translate.instant('admin.uploadFailed') });
      },
    });
  }
}
