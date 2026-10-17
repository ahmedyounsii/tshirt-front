import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { DesignCategoryModel } from '../../../../../../models/design-catergory.model';
import { CategoriesService } from '../../../../../../services/categories/categories.service';
import {
  CategoryChipsComponent,
  ChipItem,
  toCategoryChips,
} from '../../../../../../components/category-chips/category-chips.component';

// Category id the backend understands as "every design"
export const ALL_DESIGNS = 'all_designs';

// Design categories as filter chips, "All" first
@Component({
  selector: 'app-designs-displayer-categories',
  standalone: true,
  imports: [CategoryChipsComponent],
  templateUrl: './designs-displayer-categories.component.html',
  styleUrl: './designs-displayer-categories.component.scss',
})
export class DesignsDisplayerCategoriesComponent implements OnInit {
  chips: ChipItem[] = toCategoryChips([], ALL_DESIGNS);

  private categoriesService = inject(CategoriesService);
  private cdr = inject(ChangeDetectorRef);

  @Input() selectedCategory: string = ALL_DESIGNS;
  @Output() doSelectDesignCategory = new EventEmitter<string>();

  ngOnInit(): void {
    this.categoriesService.getAllCategories().subscribe({
      next: (data) => {
        this.chips = toCategoryChips(data as DesignCategoryModel[], ALL_DESIGNS);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load categories', err),
    });
  }

  selectCategory(id: string) {
    if (id === this.selectedCategory) return;
    this.doSelectDesignCategory.emit(id);
  }
}
