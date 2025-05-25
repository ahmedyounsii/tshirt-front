import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  OnInit,
  Output,
} from '@angular/core';
import { DesignCategoryModel } from '../../../../../../models/design-catergory.model';
import { CategoriesService } from '../../../../../../services/categories/categories.service';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-designs-displayer-categories',
  standalone: true,
  imports: [FormsModule, SkeletonModule],
  templateUrl: './designs-displayer-categories.component.html',
  styleUrl: './designs-displayer-categories.component.scss',
})
export class DesignsDisplayerCategoriesComponent implements OnInit {
  designCategories: DesignCategoryModel[] = [];
  inputValue: string = '';
  loading: boolean = false;

  private categoriesService = inject(CategoriesService);
  private cdr = inject(ChangeDetectorRef);
  private searchTimeout: any;

  @Output() doClose = new EventEmitter<any>();
  @Output() doSelectDesignCategory = new EventEmitter<any>();

  ngOnInit(): void {
    this.loading = true;
    this.categoriesService.getAllCategories().subscribe((data) => {
      this.designCategories = data;
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  inputChange() {
    if (this.inputValue.length > 2 || this.inputValue.length === 0) {
      this.categoriesService
        .getCategoriesByLabel(this.inputValue)
        .subscribe((data) => {
          this.designCategories = data;
          this.cdr.detectChanges();
        });
    }
  }

  selectCategory(id: string) {
    this.doSelectDesignCategory.emit(id);
  }
}
