import { Pipe, PipeTransform } from '@angular/core';
import { templateImageUrl } from '../services/templates/templates.service';

// [src]="template.frontImg | templateImage"
@Pipe({
  name: 'templateImage',
  standalone: true,
})
export class TemplateImagePipe implements PipeTransform {
  transform(path?: string | null): string {
    return templateImageUrl(path);
  }
}
