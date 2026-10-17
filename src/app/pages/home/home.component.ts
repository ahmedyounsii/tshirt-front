import { Component } from '@angular/core';
import { CardInfoComponent } from '../../components/card-info/card-info.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { ShowcaseDesignComponent } from '../../shared/showcase-design/showcase-design.component';
import { ShowcaseProductComponent } from '../../shared/showcase-product/showcase-product.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    TranslatePipe,
    CardInfoComponent,
    ShowcaseDesignComponent,
    ShowcaseProductComponent,
    FooterComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
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
