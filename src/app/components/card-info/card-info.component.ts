import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-card-info',
  standalone: true,
  imports: [RouterModule],
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
}
