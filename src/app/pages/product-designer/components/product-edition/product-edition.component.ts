import {
  computed,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Output,
} from '@angular/core';
import { tshirtTemplate } from '../../../../shared/templates';
import { SelectedProductService } from '../../../../services/selected-product.service';
import { TemplateModel } from '../../../../models/template.model';
import { PanelHeaderComponent } from '../panel-header/panel-header.component';
import { TranslatePipe } from '@ngx-translate/core';

// A product model (regular, washed, oversize, sweatshirt...) and its colors
type ProductModelGroup = { style: string; templates: TemplateModel[] };

// Templates grouped by style, in the order of the templates list
const groupByStyle = (templates: TemplateModel[]): ProductModelGroup[] => {
  const groups = new Map<string, TemplateModel[]>();
  for (const t of templates) {
    const style = t.style || t.type;
    groups.set(style, [...(groups.get(style) ?? []), t]);
  }
  return [...groups].map(([style, templates]) => ({ style, templates }));
};

// "black washed" -> "black": colors shared across models
const toneOf = (t: TemplateModel) => t.colorLabel.split(' ')[0];

@Component({
  selector: 'app-product-edition',
  standalone: true,
  imports: [TranslatePipe, PanelHeaderComponent],
  templateUrl: './product-edition.component.html',
  styleUrl: './product-edition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductEditionComponent {
  @Output() doClose = new EventEmitter<any>();

  private selectedProductService = inject(SelectedProductService);

  selectedProduct = this.selectedProductService.product;

  private readonly groups = groupByStyle(tshirtTemplate);

  // Each card previews the selected color when it's of that model, else its first one
  readonly models = computed(() => {
    const selected = this.selectedProduct();
    return this.groups.map((group) => {
      const current = group.templates.find((t) => t.id === selected?.id);
      return {
        ...group,
        selected: !!current,
        preview: current ?? group.templates[0],
      };
    });
  });

  // Switching model keeps the color when the model has it (white stays white)
  selectModel(group: ProductModelGroup) {
    const current = this.selectedProduct();
    if (group.templates.some((t) => t.id === current?.id)) return;
    const tone = current ? toneOf(current) : null;
    this.selectProduct(
      group.templates.find((t) => toneOf(t) === tone) ?? group.templates[0]
    );
  }

  selectProduct(item: TemplateModel) {
    this.selectedProductService.selectProduct(item);
  }
}
