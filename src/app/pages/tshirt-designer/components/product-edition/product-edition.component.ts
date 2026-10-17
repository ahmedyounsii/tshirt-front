import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  inject,
  OnInit,
  Output,
} from '@angular/core';
import { tshirtTemplate } from '../../../../shared/templates';
import { SelectedProductService } from '../../../../services/selected-product.service';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { TemplateModel } from '../../../../models/template.model';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { PanelHeaderComponent } from '../panel-header/panel-header.component';

type TshirtFit = 'regular' | 'oversize';

@Component({
  selector: 'app-product-edition',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    NgTemplateOutlet,
    PanelHeaderComponent,
    SelectButtonModule,
  ],
  templateUrl: './product-edition.component.html',
  styleUrl: './product-edition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductEditionComponent implements OnInit {
  @Output() doSelectProduct = new EventEmitter<any>();
  @Output() doClose = new EventEmitter<any>();

  private selectedProductService = inject(SelectedProductService);
  private cdr = inject(ChangeDetectorRef);

  tshirtTemplate = tshirtTemplate;
  selectedProduct = this.selectedProductService.product;

  regularTshirts: any;
  oversizeTshirts: any;
  washedTshirts: any;

  readonly fitOptions: { value: TshirtFit; label: string }[] = [
    { value: 'regular', label: 'Regular' },
    { value: 'oversize', label: 'Oversize' },
  ];
  fit: TshirtFit = 'regular';

  ngOnInit(): void {
    // Open on the fit of the current product (acid washed tees are a regular fit)
    this.fit =
      this.selectedProduct()?.style === 'oversize' ? 'oversize' : 'regular';
    this.regularTshirts = tshirtTemplate.filter((el) => el.style === 'regular');
    this.oversizeTshirts = tshirtTemplate.filter(
      (el) => el.style === 'oversize'
    );
    this.washedTshirts = tshirtTemplate.filter((el) => el.style === 'washed');
  }

  selectProduct(item: any) {
    this.selectedProductService.selectProduct(item);
  }
}
