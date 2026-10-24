import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../icon/icon.component';

// Placeholder displayed when a list has no data; the button only shows when buttonLabel is set
@Component({
  selector: 'app-empty',
  standalone: true,
  imports: [IconComponent, ButtonModule],
  templateUrl: './empty.component.html',
  styleUrl: './empty.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() icon = 'pi pi-search';
  @Input() buttonLabel = '';
  @Input() buttonIcon = '';
  @Output() doAction = new EventEmitter<void>();
}
