import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';

// Products hearted by the logged in user: unhearting one drops its card
@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [ProductGalleryComponent],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesComponent {}
