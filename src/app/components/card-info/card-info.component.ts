import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TagComponent } from '../tag/tag.component';

@Component({
  selector: 'app-card-info',
  standalone: true,
  imports: [TagComponent, RouterModule],
  templateUrl: './card-info.component.html',
  styleUrl: './card-info.component.scss',
})
export class CardInfoComponent {
  @Input() cardClass: any = null;
  @Input() title = 'Thousands of free templates';
  @Input() description = 'Free and easy way to bring your ideas to life';
  @Input() link: string | null = null;
  @Input() imgUrl: any = null;
  @Input() eyebrow: string | null = null;
  @Input() icon: string | null = null;
  @Input() ctaLabel: string | null = null;
  // 1 on the card that holds the page's main heading
  @Input() headingLevel: 1 | 2 = 2;
  // Empty when the image is only decorative
  @Input() imgAlt = '';
}
