import { Component } from '@angular/core';
import { DesignGalleryComponent } from '../../components/design-gallery/design-gallery.component';

// The gallery, limited to the tshirts saved by the logged in user
@Component({
  selector: 'app-my-designs',
  standalone: true,
  imports: [DesignGalleryComponent],
  template: `<app-design-gallery [mine]="true" />`,
  styles: `
    :host {
      display: block;
      padding-top: 1rem;
      padding-bottom: 1rem;
    }
  `,
})
export class MyDesignsComponent {}
