import { Component, Input } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon.component';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
  host: { '[class.action]': 'action' },
})
export class StatCardComponent {
  @Input() icon = '';
  @Input() value: string | number = '';
  @Input() label = '';
  // Renders as a dashed, clickable card; listen with (click) on the host
  @Input() action = false;
}
