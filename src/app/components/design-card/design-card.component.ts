import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DesignModel } from '../../models/design.model';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-design-card',
  standalone: true,
  imports: [TranslatePipe, ButtonModule],
  templateUrl: './design-card.component.html',
  styleUrl: './design-card.component.scss',
  host: { '[class.deleting]': 'deleting' },
})
export class DesignCardComponent {
  @Input({ required: true }) design!: DesignModel;
  // Shows the delete button (admin)
  @Input() deletable = false;
  @Input() deleting = false;
  // Shows the "Use it" button under the image
  @Input() usable = false;
  @Output() remove = new EventEmitter<DesignModel>();
  // Image clicked: the parent shows the preview
  @Output() open = new EventEmitter<DesignModel>();
  // "Use it" clicked: the parent opens the designer with this design
  @Output() use = new EventEmitter<DesignModel>();
}
