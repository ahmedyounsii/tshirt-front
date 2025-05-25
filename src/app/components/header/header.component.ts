import { NgClass } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { menuItems } from './config';
import { CartSummaryComponent } from '../cart-summary/cart-summary.component';
import { SubItemsComponent } from '../sub-items/sub-items.component';
import { trigger, transition, style, animate } from '@angular/animations';

interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  link?: string;
  active?: boolean;
  items?: MenuItem[];
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, NgClass, CartSummaryComponent, SubItemsComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  animations: [
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('300ms ease-out', style({ opacity: 0 }))]),
    ]),
  ],
})
export class HeaderComponent implements OnInit {
  private router = inject(Router);

  items: MenuItem[] = menuItems;
  selectedLink = null;

  ngOnInit() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.selectedLink = null;
        this.activateMenuItemByLink(this.items, event.url);
      });
  }

  activateMenuItemByLink(items: any[], link: string): boolean {
    let found = false;

    for (const item of items) {
      item.active = false;

      if (item.items) {
        const childActive = this.activateMenuItemByLink(item.items, link);
        if (childActive) {
          item.active = true;
          found = true;
        }
      }

      if (item.link === link) {
        item.active = true;
        found = true;
      }
    }

    return found;
  }

  showSubItems(item: any) {
    this.items.map((el) => {
      if (el.id != item.id && el.items) {
        el.active = false;
      }
    });
    item.active = !item.active;
    this.selectedLink = item.active ? item : null;
  }
}
