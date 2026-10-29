import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import {
  DesignsGalleryComponent,
  DesignsGalleryNotice,
} from '../designs-gallery/designs-gallery.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../../pages/design-manage/components/admin-toast/admin-toast.component';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';

// Designs tab of a profile: the designs "creator" shared, each one opening in the designer.
// "mine" for the logged in user's, with the share button (and the gallery's edit and
// delete buttons on their own designs)
@Component({
  selector: 'app-profile-designs',
  standalone: true,
  imports: [TranslatePipe, RouterLink, ButtonModule, DesignsGalleryComponent, AdminToastComponent],
  template: `
    @if (creator) {
      <app-designs-gallery
        [title]="mine ? 'common.mySharedDesigns' : 'common.designs'"
        [categories]="categories()"
        [createdBy]="creator"
        [openInDesigner]="true"
        [emptyTitle]="mine ? 'designsGallery.noShared' : 'designsGallery.empty'"
        [emptyButtonLabel]="mine ? 'designsGallery.shareFirst' : ''"
        (emptyAction)="router.navigate(['/my-designs/new'])"
        (notify)="showToast($event)"
      >
        @if (mine) {
          <p-button
            galleryActions
            icon="pi pi-upload"
            [label]="'designsGallery.shareDesign' | translate"
            routerLink="/my-designs/new"
          />
        }
      </app-designs-gallery>
    }

    @if (toast(); as toast) {
      <app-admin-toast [toast]="toast" />
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDesignsComponent implements OnInit {
  router = inject(Router);
  private categoriesService = inject(CategoriesService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @Input() mine = false;
  // User id
  @Input() creator: string | null = null;

  // Filter chips of the gallery
  readonly categories = signal<DesignCategoryModel[]>([]);
  readonly toast = signal<AdminToast | null>(null);
  private toastTimeout?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.categoriesService.getAllCategories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: (err) => console.error('Failed to load categories', err),
    });
  }

  showToast(notice: DesignsGalleryNotice) {
    this.toast.set(notice);
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toast.set(null), 3000);
  }
}
