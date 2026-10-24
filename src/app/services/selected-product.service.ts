import { computed, inject, Injectable, signal } from '@angular/core';
import { TemplateModel } from '../models/template.model';
import { TemplatesService } from './templates/templates.service';

@Injectable({
  providedIn: 'root',
})
export class SelectedProductService {
  private templatesService = inject(TemplatesService);
  private _product = signal<TemplateModel | null>(null); // private

  // The picked template, else the first one; null while the templates load (or when there are none)
  readonly product = computed<TemplateModel | null>(
    () => this._product() ?? this.templatesService.templates()[0] ?? null,
  );

  // null goes back to the default template
  selectProduct(product: TemplateModel | null) {
    this._product.set(product);
  }
}
