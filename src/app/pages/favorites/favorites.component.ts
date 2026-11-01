import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';
import {
  DesignsGalleryComponent,
  DesignsGalleryNotice,
} from '../../components/designs-gallery/designs-gallery.component';
import {
  SelectButtonComponent,
  SelectButtonOption,
} from '../../components/selectbutton/selectbutton.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../design-manage/components/admin-toast/admin-toast.component';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';

type FavoritesTab = 'products' | 'designs';

// Products and designs hearted by the logged in user: unhearting one drops its card
@Component({
    selector: 'app-favorites',
    imports: [
        ProductGalleryComponent,
        DesignsGalleryComponent,
        SelectButtonComponent,
        AdminToastComponent,
        TranslatePipe,
    ],
    templateUrl: './favorites.component.html',
    styleUrl: './favorites.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FavoritesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private categoriesService = inject(CategoriesService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly tabs: SelectButtonOption<FavoritesTab>[] = [
    { value: 'products', label: 'gallery.products', icon: 'sp-icon sp-shirt' },
    { value: 'designs', label: 'common.designs', icon: 'sp-icon sp-image-1' },
  ];

  private readonly tabParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('tab'))),
  );
  readonly tab = computed<FavoritesTab>(() =>
    this.tabParam() === 'designs' ? 'designs' : 'products',
  );

  // Filter chips of the designs gallery
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

  selectTab(tab: FavoritesTab) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'designs' ? 'designs' : null },
      replaceUrl: true,
    });
  }

  // Empty designs tab: the public designs gallery
  browseDesigns() {
    this.router.navigate(['/designs']);
  }

  showToast(notice: DesignsGalleryNotice) {
    this.toast.set(notice);
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toast.set(null), 3000);
  }
}
