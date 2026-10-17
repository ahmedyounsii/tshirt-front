import { Injectable, OnInit, signal } from '@angular/core';
import { tshirtTemplate } from '../shared/templates';
import { TemplateModel } from '../models/template.model';

@Injectable({
  providedIn: 'root',
})
export class SelectedProductService {
  tshirtTemplate = tshirtTemplate;
  private _product = signal<TemplateModel>(tshirtTemplate[0]); // private

  // expose readonly signal to components
  readonly product = this._product.asReadonly();

  selectProduct(product: TemplateModel) {
    this._product.set(product);
  }
}
