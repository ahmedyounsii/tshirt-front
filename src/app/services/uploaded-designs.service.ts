import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DesignModel } from '../models/design.model';
import {
  IMAGE_REJECTION_KEYS,
  MAX_FILES_PER_BATCH,
  MAX_UPLOAD_MB,
  prepareImage,
} from '../shared/image-upload';

@Injectable({
  providedIn: 'root',
})
export class uploadedDesignsService {
  private translate = inject(TranslateService);

  // Kept local (blob urls) until a product using them is saved, then stored in the backend
  uploadedDesigns = signal<DesignModel[]>([]);
  // Messages of the files rejected by the last batch
  errors = signal<string[]>([]);
  // Files are being prepared (checked, downscaled)
  processing = signal(false);
  // A file is dragged over the designer: its upload zone highlights
  draggingFiles = signal(false);

  // Batches wait for the previous one: images are prepared one at a time to bound memory
  private queue: Promise<unknown> = Promise.resolve();

  // Prepares the files and adds the valid ones to the uploads. Resolves with those added
  addFiles(files: File[]): Promise<DesignModel[]> {
    const run = this.queue.then(() => this.process(files));
    this.queue = run;
    return run;
  }

  private async process(files: File[]): Promise<DesignModel[]> {
    if (!files.length) return [];
    this.processing.set(true);
    const errors: string[] = [];
    const added: DesignModel[] = [];

    for (const file of files.slice(0, MAX_FILES_PER_BATCH)) {
      const prepared = await prepareImage(file);
      if ('error' in prepared) {
        errors.push(
          this.translate.instant(IMAGE_REJECTION_KEYS[prepared.error], {
            name: file.name,
            size: MAX_UPLOAD_MB,
          }),
        );
        continue;
      }
      added.push({
        url: URL.createObjectURL(prepared.file),
        label: file.name.replace(/\.[^.]+$/, ''),
      });
    }
    if (files.length > MAX_FILES_PER_BATCH) {
      errors.push(
        this.translate.instant('upload.tooManyFiles', {
          count: MAX_FILES_PER_BATCH,
        }),
      );
    }

    if (added.length) this.uploadedDesigns.update((values) => [...values, ...added]);
    this.errors.set(errors);
    this.processing.set(false);
    return added;
  }
}
