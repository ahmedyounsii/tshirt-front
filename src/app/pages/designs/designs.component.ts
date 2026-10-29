import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DesignsGalleryComponent,
  DesignsGalleryNotice,
} from '../../components/designs-gallery/designs-gallery.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../design-manage/components/admin-toast/admin-toast.component';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { TagComponent } from '../../components/tag/tag.component';
import { IconComponent } from '../../components/icon/icon.component';

// Static art fanned out in the hero (same files as the home showcase)
const HERO_DESIGNS = [1, 2, 3].map((n) => `./assets/designs/design_${n}.webp`);

const DESIGNS_STEPS = [
  { icon: 'pi pi-search', title: 'designsPage.steps.pick.title', text: 'designsPage.steps.pick.text' },
  { icon: 'pi pi-pencil', title: 'designsPage.steps.customize.title', text: 'designsPage.steps.customize.text' },
  { icon: 'pi pi-print', title: 'designsPage.steps.order.title', text: 'designsPage.steps.order.text' },
];

// Every design, filtered and paginated: opened from "See all designs" of the home showcase
@Component({
  selector: 'app-designs',
  standalone: true,
  imports: [
    IconComponent,
    TagComponent,
    DesignsGalleryComponent,
    AdminToastComponent,
    ButtonModule,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './designs.component.html',
  styleUrl: './designs.component.scss',
})
export class DesignsComponent implements OnInit {
  private categoriesService = inject(CategoriesService);
  private cdr = inject(ChangeDetectorRef);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly heroDesigns = HERO_DESIGNS;
  readonly steps = DESIGNS_STEPS;

  // Filter chips of the gallery
  categories: DesignCategoryModel[] = [];
  toast: AdminToast | null = null;
  private toastTimeout?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.categoriesService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load categories', err),
    });
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

  scrollToGallery(el: HTMLElement) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
