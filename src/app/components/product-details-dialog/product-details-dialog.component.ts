import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { ProductsService } from '../../services/products/products.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { ProductModel } from '../../models/product.model';
import { ProductTagsComponent } from '../product-tags/product-tags.component';

// Owner: renames a product and changes its category and tags, shown while product is set.
// The design itself is changed in the designer ("Redesign").
// With submit, the details go there instead (e.g. making a product from an order's design)
export type ProductDetails = { label: string; category: string | null; tags: string[] };

@Component({
  selector: 'app-product-details-dialog',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ProductTagsComponent,
  ],
  templateUrl: './product-details-dialog.component.html',
  styleUrl: './product-details-dialog.component.scss',
})
export class ProductDetailsDialogComponent implements OnChanges {
  private productsService = inject(ProductsService);
  private cdr = inject(ChangeDetectorRef);

  @Input() product: ProductModel | null = null;
  @Input() categories: DesignCategoryModel[] = [];
  @Input() header = 'gallery.editDetails';
  @Input() submit: ((details: ProductDetails) => Observable<ProductModel>) | null = null;
  @Output() closed = new EventEmitter<void>();
  // Emits the product as saved by the server
  @Output() saved = new EventEmitter<ProductModel>();

  label = '';
  categoryId: string | null = null;
  tags: string[] = [];
  saving = false;
  failed = false;

  get canSave(): boolean {
    return !!this.label.trim() && !this.saving;
  }

  ngOnChanges(): void {
    if (this.product) {
      this.label = this.product.label || '';
      // Deleted or missing categories show as none
      const known = this.categories.some((c) => c._id === this.product?.category);
      this.categoryId = known ? this.product.category! : null;
      this.tags = this.product.tags ?? [];
      this.failed = false;
    }
  }

  close() {
    if (!this.saving) this.closed.emit();
  }

  save() {
    if (!this.canSave || !this.product || (!this.submit && !this.product._id)) return;
    this.saving = true;
    this.failed = false;
    const details: ProductDetails = {
      label: this.label.trim(),
      category: this.categoryId,
      tags: this.tags,
    };
    (this.submit
      ? this.submit(details)
      : this.productsService.updateDetails(this.product._id!, details)
    ).subscribe({
      next: (product) => {
        this.saving = false;
        this.saved.emit(product);
      },
      error: () => {
        this.saving = false;
        this.failed = true;
        this.cdr.detectChanges();
      },
    });
  }
}
