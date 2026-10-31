import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  DesignsGalleryComponent,
  DesignsGalleryNotice,
} from '../../components/designs-gallery/designs-gallery.component';
import { SHARED_STATE } from '../share-design/share-design.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../design-manage/components/admin-toast/admin-toast.component';
import { AuthService } from '../../services/auth/auth.service';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';

// Designs shared by the logged in user (public in the designs gallery): share a new one
// (/my-designs/new), edit its name, tags and categories, or delete it
@Component({
    selector: 'app-my-designs',
    imports: [
        TranslatePipe,
        DesignsGalleryComponent,
        RouterLink,
        AdminToastComponent,
    ],
    templateUrl: './my-designs.component.html',
    styleUrl: './my-designs.component.scss'
})
export class MyDesignsComponent implements OnInit {
  auth = inject(AuthService);
  private categoriesService = inject(CategoriesService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Filter chips of the gallery
  categories: DesignCategoryModel[] = [];
  toast: AdminToast | null = null;
  private toastTimeout?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    // Back from the share page
    if (history.state?.[SHARED_STATE]) {
      this.showToast({ type: 'success', message: this.translate.instant('designsGallery.shared') });
    }
    this.categoriesService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load categories', err),
    });
  }

  share() {
    this.router.navigate(['/my-designs/new']);
  }

  showToast(notice: DesignsGalleryNotice) {
    this.toast = notice;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast = null;
      this.cdr.detectChanges();
    }, 3000);
    this.cdr.detectChanges();
  }
}
