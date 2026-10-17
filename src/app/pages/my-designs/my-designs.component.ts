import { Component } from '@angular/core';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';

// The gallery, limited to the products saved by the logged in user
@Component({
  selector: 'app-my-designs',
  standalone: true,
  imports: [ProductGalleryComponent],
  template: `<app-product-gallery [mine]="true" />`,
  styles: `
    :host {
      display: block;
      padding-top: 1rem;
      padding-bottom: 1rem;
    }
  `,
})
export class MyDesignsComponent {}
