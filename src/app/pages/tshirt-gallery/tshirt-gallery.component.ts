import { Component } from '@angular/core';
import { DesignGalleryComponent } from '../../components/design-gallery/design-gallery.component';

// Every tshirt, paginated: opened from the "See more" button of the home carousel
@Component({
  selector: 'app-tshirt-gallery',
  standalone: true,
  imports: [DesignGalleryComponent],
  template: `<app-design-gallery />`,
  styles: `
    :host {
      display: block;
      padding-top: 1rem;
      padding-bottom: 1rem;
    }
  `,
})
export class TshirtGalleryComponent {}
