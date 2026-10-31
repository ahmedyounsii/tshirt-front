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
import { DesignsDisplayerState } from '../../designs-displayer.state';

// Category id the backend understands as "every design"
export const ALL_DESIGNS = 'all_designs';

// Design categories as filter chips, "All" first
@Component({
    selector: 'app-designs-displayer-categories',
    imports: [CategoryChipsComponent],
    templateUrl: './designs-displayer-categories.component.html',
    styleUrl: './designs-displayer-categories.component.scss'
})
export class DesignsDisplayerCategoriesComponent implements OnInit {
  private state = inject(DesignsDisplayerState);
  private categoriesService = inject(CategoriesService);

  chips: ChipItem[] = this.state.chips ?? toCategoryChips([], ALL_DESIGNS);
  private cdr = inject(ChangeDetectorRef);

  @Input() selectedCategory: string = ALL_DESIGNS;
  @Output() doSelectDesignCategory = new EventEmitter<string>();

  ngOnInit(): void {
    // Already loaded at a previous opening
    if (this.state.chips) return;
    this.categoriesService.getAllCategories().subscribe({
      next: (data) => {
        this.chips = this.state.chips = toCategoryChips(
          data as DesignCategoryModel[],
          ALL_DESIGNS,
        );
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
