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
import { MultiSelectModule } from 'primeng/multiselect';
import { TranslatePipe } from '@ngx-translate/core';
import { DesignsService } from '../../services/designs/design.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { DesignModel } from '../../models/design.model';

// Admin: picks the categories of a design (one or many), shown while design is set
@Component({
  selector: 'app-design-categories-dialog',
  standalone: true,
  imports: [TranslatePipe, FormsModule, DialogModule, ButtonModule, MultiSelectModule],
  templateUrl: './design-categories-dialog.component.html',
  styleUrl: './design-categories-dialog.component.scss',
})
export class DesignCategoriesDialogComponent implements OnChanges {
  private designsService = inject(DesignsService);
  private cdr = inject(ChangeDetectorRef);

  @Input() design: DesignModel | null = null;
  @Input() categories: DesignCategoryModel[] = [];
  @Output() closed = new EventEmitter<void>();
  // Emits the categories saved on the design
  @Output() saved = new EventEmitter<string[]>();

  categoryIds: string[] = [];
  saving = false;
  failed = false;

  get canSave(): boolean {
    return !!this.categoryIds.length && !this.saving;
  }

  ngOnChanges(): void {
    if (this.design) {
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
    this.designsService.setCategories(this.design._id, this.categoryIds).subscribe({
      next: (res) => {
        this.saving = false;
        this.saved.emit(res.categoryIds.map(String));
      },
      error: () => {
        this.saving = false;
        this.failed = true;
        this.cdr.detectChanges();
      },
    });
  }
}
