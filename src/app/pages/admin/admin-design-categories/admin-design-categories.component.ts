import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SkeletonComponent } from '../../../components/skeleton/skeleton.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CategoriesService } from '../../../services/categories/categories.service';
import { DesignCategoryModel } from '../../../models/design-catergory.model';
import { SearchInputComponent } from '../../../components/search-input/search-input.component';
import { CategoryCardComponent } from '../../design-manage/components/category-card/category-card.component';
import { EmptyComponent } from '../../../components/empty/empty.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../../design-manage/components/admin-toast/admin-toast.component';
import { ConfirmService } from '../../../services/confirm/confirm.service';

// Admin: the design categories (/admin/designs/categories), added, searched and deleted.
// A category opens the designs page filtered on it
@Component({
    selector: 'app-admin-design-categories',
    imports: [
        TranslatePipe,
        FormsModule,
        SkeletonComponent,
        SearchInputComponent,
        CategoryCardComponent,
        EmptyComponent,
        AdminToastComponent,
    ],
    templateUrl: './admin-design-categories.component.html',
    styleUrl: './admin-design-categories.component.scss'
})
export class AdminDesignCategoriesComponent implements OnInit {
  private router = inject(Router);
  private categoriesService = inject(CategoriesService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  toast: AdminToast | null = null;
  private toastTimeout: any;

  categories: DesignCategoryModel[] = [];
  categoriesLoading = false;
  categorySearch = '';
  categoryLabel = '';
  addingCategory = false;
  deletingCategoryId: string | null = null;

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories() {
    this.categoriesLoading = true;
    const request = this.categorySearch.trim()
      ? this.categoriesService.getCategoriesByLabel(this.categorySearch.trim())
      : this.categoriesService.getAllCategories();
    request.subscribe({
      next: (data) => {
        this.categories = data;
        this.categoriesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.categoriesLoading = false;
        this.showToast('error', this.translate.instant('admin.loadCategoriesFailed'));
      },
    });
  }

  onCategorySearch() {
    if (this.categorySearch.length > 2 || this.categorySearch.length === 0) {
      this.loadCategories();
    }
  }

  addCategory() {
    const label = this.categoryLabel.trim();
    if (!label || this.addingCategory) return;
    this.addingCategory = true;
    this.categoriesService.addCategory(label).subscribe({
      next: () => {
        this.categoryLabel = '';
        this.addingCategory = false;
        this.showToast(
          'success',
          this.translate.instant('admin.categoryAdded', { label }),
        );
        this.loadCategories();
      },
      error: () => {
        this.addingCategory = false;
        this.showToast('error', this.translate.instant('admin.addCategoryFailed'));
      },
    });
  }

  async deleteCategory(category: DesignCategoryModel) {
    if (this.deletingCategoryId) return;
    const count = category.designs?.length || 0;
    const message = count
      ? this.translate.instant('admin.deleteCategoryWithDesigns', {
          label: category.label,
          count,
        })
      : this.translate.instant('admin.deleteCategoryMessage', {
          label: category.label,
        });
    const ok = await this.confirm.confirmDelete(
      message,
      this.translate.instant('admin.deleteCategory'),
    );
    if (!ok || this.deletingCategoryId) return;

    this.deletingCategoryId = category._id;
    this.categoriesService.deleteCategory(category._id).subscribe({
      next: () => {
        this.deletingCategoryId = null;
        this.showToast(
          'success',
          this.translate.instant('admin.categoryDeleted', {
            label: category.label,
          }),
        );
        this.loadCategories();
      },
      error: () => {
        this.deletingCategoryId = null;
        this.showToast('error', this.translate.instant('admin.deleteCategoryFailed'));
      },
    });
  }

  // The designs page, filtered on the category
  openCategoryDesigns(category: DesignCategoryModel) {
    this.router.navigate(['/admin/designs'], { queryParams: { category: category._id } });
  }

  // The designs page, filtered on the category, its upload form open
  addDesignToCategory(category: DesignCategoryModel) {
    this.router.navigate(['/admin/designs'], {
      queryParams: { category: category._id, new: 1 },
    });
  }

  showToast(type: AdminToast['type'], message: string) {
    this.toast = { type, message };
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast = null;
      this.cdr.detectChanges();
    }, 3000);
    this.cdr.detectChanges();
  }
}
