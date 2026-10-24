import {
  computed,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import { SelectedProductService } from '../../../../services/selected-product.service';
import { TemplateModel } from '../../../../models/template.model';
import { TemplatesService } from '../../../../services/templates/templates.service';
import { TemplateImagePipe } from '../../../../shared/template-image.pipe';
import { PanelHeaderComponent } from '../panel-header/panel-header.component';
import { TranslatePipe } from '@ngx-translate/core';

const styleOf = (t: TemplateModel) => t.style || t.type;

// Distinct values in the order of the templates list
const unique = (values: string[]) => [...new Set(values)];

@Component({
  selector: 'app-product-edition',
  standalone: true,
  imports: [TranslatePipe, PanelHeaderComponent, TemplateImagePipe],
  templateUrl: './product-edition.component.html',
  styleUrl: './product-edition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductEditionComponent {
  @Input() hideColorName = true;
  @Output() doClose = new EventEmitter<any>();

  private selectedProductService = inject(SelectedProductService);
  private templatesService = inject(TemplatesService);

  private templates = this.templatesService.templates;
  readonly loaded = this.templatesService.loaded;

  selectedProduct = this.selectedProductService.product;

  readonly types = computed(() => unique(this.templates().map((t) => t.type)));

  // Type and style only filter the colors: the product changes once a color is picked
  private browsedType = signal<string | null>(null);
  private browsedStyle = signal<string | null>(null);

  readonly activeType = computed(
    () => this.browsedType() ?? this.selectedProduct()?.type ?? this.types()[0]
  );

  readonly styles = computed(() =>
    unique(
      this.templates()
        .filter((t) => t.type === this.activeType())
        .map(styleOf)
    )
  );

  readonly activeStyle = computed(() => {
    const browsed = this.browsedStyle();
    if (browsed && this.styles().includes(browsed)) return browsed;
    const selected = this.selectedProduct();
    return selected?.type === this.activeType()
      ? styleOf(selected)
      : this.styles()[0];
  });

  readonly colors = computed(() =>
    this.templates().filter(
      (t) => t.type === this.activeType() && styleOf(t) === this.activeStyle()
    )
  );

  selectType(type: string) {
    if (type === this.activeType()) return;
    this.browsedType.set(type);
    this.browsedStyle.set(null);
  }

  selectStyle(style: string) {
    this.browsedStyle.set(style);
  }

  selectProduct(item: TemplateModel) {
    this.selectedProductService.selectProduct(item);
    this.browsedType.set(null);
    this.browsedStyle.set(null);
  }
}
