import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { ButtonModule } from 'primeng/button';
import { AdminNavComponent, AdminPanel } from './components/admin-nav/admin-nav.component';
import { StatCardComponent } from './components/stat-card/stat-card.component';
import { SearchInputComponent } from '../../components/search-input/search-input.component';
import { CategoryCardComponent } from './components/category-card/category-card.component';
import {
  ALL_DESIGNS,
  DesignsGalleryComponent,
} from '../../components/designs-gallery/designs-gallery.component';
import { UploadFormComponent } from './components/upload-form/upload-form.component';
import { EmptyComponent } from '../../components/empty/empty.component';
import { AdminToast, AdminToastComponent } from './components/admin-toast/admin-toast.component';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { TemplatesService } from '../../services/templates/templates.service';
import { TemplatesPanelComponent } from './components/templates-panel/templates-panel.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-design-manage',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    FormsModule,
    SkeletonModule,
    InputTextModule,
    AdminNavComponent,
    StatCardComponent,
    SearchInputComponent,
    CategoryCardComponent,
    DesignsGalleryComponent,
    UploadFormComponent,
    EmptyComponent,
    AdminToastComponent,
    TemplatesPanelComponent,
  ],
  templateUrl: './design-manage.component.html',
  styleUrl: './design-manage.component.scss',
})
export class DesignManageComponent implements OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private categoriesService = inject(CategoriesService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  readonly templates = inject(TemplatesService).templates;

  @ViewChild(DesignsGalleryComponent) private gallery?: DesignsGalleryComponent;

  activePanel: AdminPanel = 'categories';
  toast: AdminToast | null = null;
  private toastTimeout: any;

  // Categories
  categories: DesignCategoryModel[] = [];
  categoriesLoading = false;
  categorySearch = '';
  categoryLabel = '';
  addingCategory = false;
  deletingCategoryId: string | null = null;

  // Category shown in the designs gallery
  filterCategoryId: string = ALL_DESIGNS;

  // New design form
  showUploadForm = false;
  // Categories preselected in the form
  uploadCategoryIds: string[] = [];

  // A design can be in several categories: counted once
  get totalDesigns(): number {
    return new Set(this.categories.flatMap((c) => (c.designs || []).map(String))).size;
  }

  ngOnInit(): void {
    this.activatedRoute.params.subscribe((params) => {
      if (params['id'] === 'designs' || params['id'] === 'templates') {
        this.activePanel = params['id'];
      }
    });
    this.loadCategories();
  }

  setPanel(panel: AdminPanel) {
    this.activePanel = panel;
  }

  // ---------- Categories ----------

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
        this.uploadCategoryIds = this.uploadCategoryIds.filter(
          (id) => id !== category._id,
        );
        this.loadCategories();
        this.showCategoryDesigns(
          this.filterCategoryId === category._id
            ? ALL_DESIGNS
            : this.filterCategoryId,
        );
      },
      error: () => {
        this.deletingCategoryId = null;
        this.showToast('error', this.translate.instant('admin.deleteCategoryFailed'));
      },
    });
  }

  openCategoryDesigns(category: DesignCategoryModel) {
    this.uploadCategoryIds = [category._id];
    this.activePanel = 'designs';
    this.showCategoryDesigns(category._id);
  }

  addDesignToCategory(category: DesignCategoryModel) {
    this.openCategoryDesigns(category);
    this.openUploadForm();
  }

  // ---------- Designs ----------

  // Preselects the shown category, unless the form is open with a choice already made
  onFilterCategoryChange(categoryId: string) {
    if (categoryId !== ALL_DESIGNS && !(this.showUploadForm && this.uploadCategoryIds.length)) {
      this.uploadCategoryIds = [categoryId];
    }
  }

  // The gallery only exists while the designs panel is shown
  private showCategoryDesigns(categoryId: string) {
    this.filterCategoryId = categoryId;
    this.gallery?.selectCategory(categoryId);
  }

  // ---------- Upload ----------

  openUploadForm() {
    this.showUploadForm = true;
    if (!this.uploadCategoryIds.length && this.filterCategoryId !== ALL_DESIGNS) {
      this.uploadCategoryIds = [this.filterCategoryId];
    }
  }

  // Stays on the shown category when the design was added to it
  onDesignUploaded(categoryIds: string[]) {
    this.showUploadForm = false;
    this.showCategoryDesigns(
      categoryIds.includes(this.filterCategoryId) ? this.filterCategoryId : categoryIds[0],
    );
    this.loadCategories();
  }

  // ---------- Toast ----------

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
