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
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { SelectComponent } from '../select/select.component';
import { TranslatePipe } from '@ngx-translate/core';
import { DesignsService } from '../../services/designs/design.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { DesignModel } from '../../models/design.model';
import { ProductTagsComponent } from '../product-tags/product-tags.component';

// What the dialog saved on the design
export type DesignEdit = Required<Pick<DesignModel, 'label' | 'tags' | 'categoryIds'>>;

// Admin: renames a design and changes its tags and categories (one or many), shown while design is set
@Component({
    selector: 'app-design-edit-dialog',
    imports: [
        TranslatePipe,
        FormsModule,
        DialogComponent,
        SelectComponent,
        ProductTagsComponent,
    ],
    templateUrl: './design-edit-dialog.component.html',
    styleUrl: './design-edit-dialog.component.scss'
})
export class DesignEditDialogComponent implements OnChanges {
  private designsService = inject(DesignsService);
  private cdr = inject(ChangeDetectorRef);

  @Input() design: DesignModel | null = null;
  @Input() categories: DesignCategoryModel[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<DesignEdit>();

  label = '';
  tags: string[] = [];
  categoryIds: string[] = [];
  saving = false;
  failed = false;

  get canSave(): boolean {
    return !!this.label.trim() && !this.saving;
  }

  ngOnChanges(): void {
    if (this.design) {
      this.label = this.design.label || '';
      this.tags = [...(this.design.tags || [])];
      this.categoryIds = [...(this.design.categoryIds || [])];
      this.failed = false;
    }
  }

  close() {
    if (!this.saving) this.closed.emit();
  }

  save() {
    if (!this.canSave || !this.design?._id) return;
    this.saving = true;
    this.failed = false;
    this.designsService
      .updateDesign(this.design._id, {
        label: this.label.trim(),
        tags: this.tags,
        categoryIds: this.categoryIds,
      })
      .subscribe({
        next: (res) => {
          this.saving = false;
          this.saved.emit({
            label: res.design.label ?? this.label.trim(),
            tags: res.design.tags ?? this.tags,
            categoryIds: res.categoryIds.map(String),
          });
        },
        error: () => {
          this.saving = false;
          this.failed = true;
          this.cdr.detectChanges();
        },
      });
  }
}
