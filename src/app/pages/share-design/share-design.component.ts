import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { UploadFormComponent } from '../design-manage/components/upload-form/upload-form.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../design-manage/components/admin-toast/admin-toast.component';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';

// Navigation state telling "My designs" a design was just shared (it shows the toast)
export const SHARED_STATE = 'designShared';

// Any logged in user shares a design, same form as the admin's (grunge edge included):
// public right away in the designs gallery, credited to them
@Component({
  selector: 'app-share-design',
  standalone: true,
  imports: [TranslatePipe, UploadFormComponent, AdminToastComponent],
  templateUrl: './share-design.component.html',
  styleUrl: './share-design.component.scss',
})
export class ShareDesignComponent implements OnInit {
  private categoriesService = inject(CategoriesService);
  private router = inject(Router);
  private location = inject(Location);
  // Page back to once shared: "My designs", or the seller dashboard's (route data.returnUrl)
  private returnUrl: string = inject(ActivatedRoute).snapshot.data['returnUrl'] ?? '/my-designs';
  private cdr = inject(ChangeDetectorRef);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  categories: DesignCategoryModel[] = [];
  categoryIds: string[] = [];
  toast: AdminToast | null = null;
  private toastTimeout?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.categoriesService.getAllCategories().subscribe({
      next: (categories: DesignCategoryModel[]) => {
        // Designer uploads category is internal
        this.categories = categories.filter((c) => c.label.toLowerCase() !== 'uploads');
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load categories', err),
    });
  }

  // Previous route; "My designs" when the page was opened directly (no in-app history)
  goBack() {
    if (this.isBrowser && window.history.state?.navigationId > 1) this.location.back();
    else this.router.navigate([this.returnUrl]);
  }

  onUploaded() {
    this.router.navigate([this.returnUrl], { state: { [SHARED_STATE]: true } });
  }

  // Errors only: a success leaves the page
  onNotify(toast: AdminToast) {
    if (toast.type === 'success') return;
    this.toast = toast;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast = null;
      this.cdr.detectChanges();
    }, 3000);
    this.cdr.detectChanges();
  }
}
