import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CategoriesService } from '../../../services/categories/categories.service';
import { DesignCategoryModel } from '../../../models/design-catergory.model';
import {
  ALL_DESIGNS,
  DesignsGalleryComponent,
} from '../../../components/designs-gallery/designs-gallery.component';
import { UploadFormComponent } from '../../design-manage/components/upload-form/upload-form.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../../design-manage/components/admin-toast/admin-toast.component';

// Admin: every design (/admin/designs), filtered by category, edited, deleted and uploaded.
// "?category=<id>" opens it on a category, "&new=1" with the upload form open
@Component({
    selector: 'app-admin-designs',
    imports: [
        TranslatePipe,
        ButtonModule,
        DesignsGalleryComponent,
        UploadFormComponent,
        AdminToastComponent,
    ],
    templateUrl: './admin-designs.component.html',
    styles: `
    :host {
      display: block;
      min-height: calc(100vh - var(--header-height));
      padding: 1rem 0;
    }
  `
})
export class AdminDesignsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private categoriesService = inject(CategoriesService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(DesignsGalleryComponent) private gallery?: DesignsGalleryComponent;

  toast: AdminToast | null = null;
  private toastTimeout: any;

  categories: DesignCategoryModel[] = [];

  // Category shown in the designs gallery
  filterCategoryId: string = ALL_DESIGNS;

  // New design form
  showUploadForm = false;
  // Categories preselected in the form
  uploadCategoryIds: string[] = [];

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const category = params.get('category');
    if (category) {
      this.filterCategoryId = category;
      this.uploadCategoryIds = [category];
    }
    this.showUploadForm = !!params.get('new');
    this.loadCategories();
  }

  loadCategories() {
    this.categoriesService.getAllCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.cdr.detectChanges();
      },
      error: () => {
        this.showToast('error', this.translate.instant('admin.loadCategoriesFailed'));
      },
    });
  }

  // Preselects the shown category, unless the form is open with a choice already made.
  // The URL follows, so a reload stays on it
  onFilterCategoryChange(categoryId: string) {
    if (categoryId !== ALL_DESIGNS && !(this.showUploadForm && this.uploadCategoryIds.length)) {
      this.uploadCategoryIds = [categoryId];
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: categoryId === ALL_DESIGNS ? null : categoryId, new: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private showCategoryDesigns(categoryId: string) {
    this.filterCategoryId = categoryId;
    this.gallery?.selectCategory(categoryId);
  }

  openUploadForm() {
    this.showUploadForm = true;
    if (!this.uploadCategoryIds.length && this.filterCategoryId !== ALL_DESIGNS) {
      this.uploadCategoryIds = [this.filterCategoryId];
    }
  }

  // Stays on the shown category when the design was added to it ("All" for a design
  // without category)
  onDesignUploaded(categoryIds: string[]) {
    this.showUploadForm = false;
    this.showCategoryDesigns(
      categoryIds.includes(this.filterCategoryId)
        ? this.filterCategoryId
        : (categoryIds[0] ?? ALL_DESIGNS),
    );
    this.loadCategories();
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
