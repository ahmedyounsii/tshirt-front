import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardInfoComponent } from '../../components/card-info/card-info.component';
import { DesignGalleryComponent } from '../../components/design-gallery/design-gallery.component';
import { DesignsGalleryComponent } from '../../components/designs-gallery/designs-gallery.component';
import { CategoriesService } from '../../services/categories/categories.service';
import { DesignCategoryModel } from '../../models/design-catergory.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    CardInfoComponent,
    DesignGalleryComponent,
    DesignsGalleryComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private categoriesService = inject(CategoriesService);
  private cdr = inject(ChangeDetectorRef);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Filter chips of the designs gallery
  categories: DesignCategoryModel[] = [];

  // Selling points shown above the tshirts carousel
  perks = [
    { icon: 'pi pi-box', label: '3D preview' },
    { icon: 'pi pi-sync', label: 'Front & back print' },
    { icon: 'pi pi-check-circle', label: 'Made to order' },
  ];

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

  items = [
    {
      id: 'tshirt',
      label: 'T-shirt',
      img: 'banner-menu-3.jpg',
    },
    {
      id: 'long-sleeves',
      label: 'Long-sleeves',
      img: 'banner-menu-4.jpg',
    },
    {
      id: 'sweater',
      label: 'Sweater',
      img: 'banner-menu-5.jpg',
    },
    {
      id: 'hoodies',
      label: 'Hoodies',
      img: 'banner-menu-6.jpg',
    },
    {
      id: 'tanktop',
      label: 'Tanktop',
      img: 'banner-menu-7.jpg',
    },
  ];
}
