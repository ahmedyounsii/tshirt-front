import { Injectable, OnInit, signal } from '@angular/core';
import { tshirtTemplate } from '../shared/templates';
import { TemplateModel } from '../models/template.model';

@Injectable({
  providedIn: 'root',
})
export class SelectedProductService {
  tshirtTemplate = tshirtTemplate;
  product = signal<TemplateModel>(tshirtTemplate[0]);

  selectProduct(product: TemplateModel) {
    this.product.set(product);
  }
}
