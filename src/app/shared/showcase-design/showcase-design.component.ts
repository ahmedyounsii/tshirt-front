import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CategoriesService } from '../../services/categories/categories.service';
import { ALL_DESIGNS } from '../../components/designs-gallery/designs-gallery.component';
import { DesignModel } from '../../models/design.model';
import { TranslatePipe } from '@ngx-translate/core';

// Static designs of the showcase mosaic (public/assets/designs): one per tile, no API call
const SHOWCASE_DESIGNS: DesignModel[] = [1, 2, 3, 4, 5].map((n) => ({
  _id: `showcase-${n}`,
  url: `./assets/designs/design_${n}.png`,
}));
// Text of the big "Top pick" card, about the first showcase design
const SHOWCASE_FEATURE = {
  title: 'showcaseDesign.feature.title',
  // In USD, like the gallery cards
  price: 24.99,
  tags: ['anime', 'retro', 'frontPrint'].map(
    (tag) => `showcaseDesign.feature.tags.${tag}`,
  ),
};
// Shown in the showcase stat circle and checklist until the real total of designs is loaded
const SHOWCASE_COUNT_PLACEHOLDER = '…';

// Home teaser: a few static designs in a mosaic, display only, with a link to /designs
@Component({
  selector: 'app-showcase-design',
  standalone: true,
  imports: [TranslatePipe, RouterLink, CurrencyPipe],
  templateUrl: './showcase-design.component.html',
  styleUrl: './showcase-design.component.scss',
})
export class ShowcaseDesignComponent implements OnInit {
  private categoriesService = inject(CategoriesService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly designs = SHOWCASE_DESIGNS;
  // Total number of designs, shown in the stat circle and checklist
  readonly countLabel = signal(SHOWCASE_COUNT_PLACEHOLDER);
  readonly feature = SHOWCASE_FEATURE;

  ngOnInit(): void {
    // The API is only reachable from the browser
    if (!this.isBrowser) return;
    // Only the total is needed: ask for a single design
    this.categoriesService.getAllDesigns(ALL_DESIGNS, 1, 1).subscribe({
      next: (data: any) => this.countLabel.set(`${data.count || 0}+`),
    });
  }
}
