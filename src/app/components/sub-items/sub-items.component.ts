import { Component, Input } from '@angular/core';
import { CardInfoComponent } from '../card-info/card-info.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sub-items',
  standalone: true,
  imports: [CardInfoComponent, RouterModule],
  templateUrl: './sub-items.component.html',
  styleUrl: './sub-items.component.scss',
})
export class SubItemsComponent {
  @Input() selectedLink: any;

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
