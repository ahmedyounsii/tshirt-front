import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Component({
  selector: 'app-image-picker',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './image-picker.component.html',
  styleUrl: './image-picker.component.scss',
})
export class ImagePickerComponent implements OnDestroy {
  @Output() fileChange = new EventEmitter<File | null>();
  @Output() rejected = new EventEmitter<string>();

  file: File | null = null;
  previewUrl: string | null = null;
  isDragging = false;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) this.setFile(input.files[0]);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }

  removeFile() {
    this.clearPreview();
    this.file = null;
    this.fileChange.emit(null);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  ngOnDestroy(): void {
    this.clearPreview();
  }

  private setFile(file: File) {
    if (!file.type.startsWith('image/')) {
      this.rejected.emit('Only image files are allowed');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.rejected.emit('File size exceeds 10MB limit');
      return;
    }
    this.clearPreview();
    this.file = file;
    this.previewUrl = URL.createObjectURL(file);
    this.fileChange.emit(file);
  }

  private clearPreview() {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
  }
}
