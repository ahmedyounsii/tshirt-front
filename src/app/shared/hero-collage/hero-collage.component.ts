import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// A design and the background color of its tile; main is the centered t-shirt, shown without a tile
// width overrides the main image width (CSS value, e.g. 60%), the stylesheet default applies otherwise
export interface CollageDesign {
  url: string;
  color?: string;
  main?: boolean;
  width?: string;
  // Translation key of the image description
  alt?: string;
}

// Tiles in order: top-left, bottom-left, top-right, bottom-right, plus the centered t-shirt
const DEFAULT_COLLAGE_DESIGNS: CollageDesign[] = [
  { url: './assets/designs/design_1.webp', color: '#c4b5fd', alt: 'staticDesigns.1' },
  { url: './assets/designs/design_2.webp', color: '#fed7aa', alt: 'staticDesigns.2' },
  { url: './assets/designs/design_3.webp', color: '#a7f3d0', alt: 'staticDesigns.3' },
  { url: './assets/designs/design_5.webp', color: '#ddd6fe', alt: 'staticDesigns.5' },
  { url: './assets/tshirts/design_1.webp', main: true, alt: 'staticDesigns.shirt' },
];

// Decorative collage: pastel design tiles scattered around a centered t-shirt
@Component({
    selector: 'app-hero-collage',
    imports: [TranslatePipe],
    templateUrl: './hero-collage.component.html',
    styleUrl: './hero-collage.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { 'aria-hidden': 'true' }
})
export class HeroCollageComponent {
  // Only the first four non-main designs are shown, one per tile
  tiles: CollageDesign[] = [];
  main: CollageDesign | undefined;

  @Input() set designs(designs: CollageDesign[]) {
    this.tiles = designs.filter((design) => !design.main).slice(0, 4);
    this.main = designs.find((design) => design.main);
  }

  constructor() {
    this.designs = DEFAULT_COLLAGE_DESIGNS;
  }
}
