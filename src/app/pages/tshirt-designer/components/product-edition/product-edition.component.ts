import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  inject,
  Output,
} from '@angular/core';
import { tshirtTemplate } from '../../../../shared/templates';
import { SelectedProductService } from '../../../../services/selected-product.service';
import { NgClass } from '@angular/common';
import { TemplateModel } from '../../../../models/template.model';

@Component({
  selector: 'app-product-edition',
  standalone: true,
  imports: [NgClass],
  templateUrl: './product-edition.component.html',
  styleUrl: './product-edition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductEditionComponent {
  @Output() doSelectProduct = new EventEmitter<any>();
  @Output() doClose = new EventEmitter<any>();

  private selectedProductService = inject(SelectedProductService);
  private cdr = inject(ChangeDetectorRef);

  tshirtTemplate = tshirtTemplate;
  selectedProduct: TemplateModel | null = null;

  constructor() {
    effect(() => {
      this.selectedProduct = this.selectedProductService.product();
      this.cdr.detectChanges();
    });
  }

  selectProduct(item: any) {
    this.selectedProductService.selectProduct(item);
  }
}
