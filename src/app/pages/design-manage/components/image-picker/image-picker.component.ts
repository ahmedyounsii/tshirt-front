import {
  AfterViewInit,
  Component,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnDestroy,
  Output,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ACCEPTED_IMAGE_INPUT,
  filesOf,
  IMAGE_REJECTION_KEYS,
  isFileDrag,
  MAX_UPLOAD_MB,
  prepareImage,
} from '../../../../shared/image-upload';

// A file dropped just next to the zone would make the browser leave the page to open it
const blockPageDrop = (event: DragEvent) => {
  if (isFileDrag(event)) event.preventDefault();
};

@Component({
  selector: 'app-image-picker',
  standalone: true,
  imports: [TranslatePipe, ButtonModule],
  templateUrl: './image-picker.component.html',
  styleUrl: './image-picker.component.scss',
})
export class ImagePickerComponent implements AfterViewInit, OnDestroy {
  private translate = inject(TranslateService);
  private zone = inject(NgZone);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly maxSizeMb = MAX_UPLOAD_MB;
  readonly acceptedTypes = ACCEPTED_IMAGE_INPUT;

  // The file is sent as picked, whatever its size (templates)
  @Input() keepOriginal = false;
  @Output() fileChange = new EventEmitter<File | null>();
  @Output() rejected = new EventEmitter<string>();

  file: File | null = null;
  previewUrl: string | null = null;
  isDragging = false;
  // The image is being checked / downscaled
  preparing = false;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) this.setFile(input.files[0]);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    // Ignore leaving towards a child of the drop zone
    const target = event.currentTarget as HTMLElement;
    if (target.contains(event.relatedTarget as Node)) return;
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    this.isDragging = false;
    // One design per upload: the first file
    const [file] = filesOf(event.dataTransfer);
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

  // Outside Angular: dragover fires every few ms during a drag
  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.zone.runOutsideAngular(() => {
      window.addEventListener('dragover', blockPageDrop);
      window.addEventListener('drop', blockPageDrop);
    });
  }

  ngOnDestroy(): void {
    this.clearPreview();
    if (!this.isBrowser) return;
    window.removeEventListener('dragover', blockPageDrop);
    window.removeEventListener('drop', blockPageDrop);
  }

  private async setFile(file: File) {
    if (this.preparing) return;
    this.preparing = true;
    const prepared = await prepareImage(file, this.keepOriginal);
    this.preparing = false;
    if ('error' in prepared) {
      this.rejected.emit(
        this.translate.instant(IMAGE_REJECTION_KEYS[prepared.error], {
          name: file.name,
          size: MAX_UPLOAD_MB,
        }),
      );
      return;
    }
    this.clearPreview();
    this.file = prepared.file;
    this.previewUrl = URL.createObjectURL(prepared.file);
    this.fileChange.emit(prepared.file);
  }

  private clearPreview() {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
  }
}
