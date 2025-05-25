import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-card-info',
  standalone: true,
  imports: [],
  templateUrl: './card-info.component.html',
  styleUrl: './card-info.component.scss',
})
export class CardInfoComponent {
  @Input() cardClass: any = null;
  @Input() title = 'Thousands of free templates';
  @Input() description = 'Free and easy way to bring your ideas to life';
  @Input() buttonLabel = 'Explore More';
  @Input() buttonLink: any = null;
  @Input() buttonIcon = 'pi pi-arrow-right';
  @Input() imgUrl: any = null;

  private router = inject(Router);

  onClick(event: any) {
    this.router.navigate([this.buttonLink]);
  }
}
