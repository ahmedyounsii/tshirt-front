import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CategoriesService } from '../../services/categories/categories.service';
import { ALL_DESIGNS } from '../../components/designs-gallery/designs-gallery.component';
import { DesignModel } from '../../models/design.model';
import { TranslatePipe } from '@ngx-translate/core';
import { TagComponent } from '../../components/tag/tag.component';
import { PreviewService } from '../../services/preview/preview.service';

// Static designs of the showcase mosaic (public/assets/designs): one per tile, no API call
const SHOWCASE_DESIGNS: DesignModel[] = [1, 2, 3, 4, 5].map((n) => ({
  _id: `showcase-${n}`,
  url: `./assets/designs/design_${n}.webp`,
}));
// Text of the big "Top pick" card, about the first showcase design
const SHOWCASE_FEATURE = {
  title: 'showcaseDesign.feature.title',
  tags: ['anime', 'retro', 'frontPrint'].map(
    (tag) => `showcaseDesign.feature.tags.${tag}`,
  ),
};
// Shown in the showcase stat circle and checklist until the real total of designs is loaded
const SHOWCASE_COUNT_PLACEHOLDER = '…';

// Home teaser: a few static designs in a mosaic, opened in the previewer, with a link to /designs
@Component({
    selector: 'app-showcase-design',
    imports: [TagComponent, TranslatePipe, RouterLink],
    templateUrl: './showcase-design.component.html',
    styleUrl: './showcase-design.component.scss'
})
export class ShowcaseDesignComponent implements OnInit {
  private categoriesService = inject(CategoriesService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private previewer = inject(PreviewService);

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

  // Full screen preview of a design of the mosaic
  preview(design: DesignModel): void {
    this.previewer.openImage(design.url);
  }
}
