import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HomeHeroComponent } from '../../components/home-hero/home-hero.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { ShowcaseDesignComponent } from '../../shared/showcase-design/showcase-design.component';
import { ShowcaseProductComponent } from '../../shared/showcase-product/showcase-product.component';
import { CollectionShowcaseComponent } from '../../shared/collection-showcase/collection-showcase.component';
import { CollectionsService } from '../../services/collections/collections.service';
import { CollectionModel } from '../../models/collection.model';
import { TranslatePipe } from '@ngx-translate/core';
import { TagComponent } from '../../components/tag/tag.component';
import { IconComponent } from '../../components/icon/icon.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IconComponent,
    TagComponent,
    TranslatePipe,
    RouterLink,
    HomeHeroComponent,
    ShowcaseDesignComponent,
    ShowcaseProductComponent,
    CollectionShowcaseComponent,
    FooterComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private collectionsService = inject(CollectionsService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Collection the admin put on the home page, linking to its own page; none hides the section
  readonly featured = signal<CollectionModel | null>(null);

  // Selling points of the indexed copy (home.seo.points.<id>), each linking to where it happens
  seoPoints = [
    { id: 'collection', icon: 'pi pi-star', link: '/designs' },
    { id: 'photo', icon: 'pi pi-upload', link: '/designer' },
    { id: 'range', icon: 'pi pi-th-large', link: '/store' },
    { id: 'tunisia', icon: 'pi pi-truck', link: null },
  ];

  // Questions answered under the selling points (home.seo.faq.<id>)
  faq = ['create', 'single', 'designs', 'delivery', 'payment', 'care'];

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    this.collectionsService.getFeatured().subscribe({
      next: (collection) => this.featured.set(collection),
      error: (err) => console.error('Failed to load the featured collection', err),
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
