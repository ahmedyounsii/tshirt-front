import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DesignCreator, DesignModel } from '../../models/design.model';
import { creatorLink } from '../../models/user.model';
import { TranslatePipe } from '@ngx-translate/core';
import { TagComponent } from '../tag/tag.component';

@Component({
  selector: 'app-design-card',
  standalone: true,
  imports: [TagComponent, TranslatePipe, ButtonModule, NgTemplateOutlet, RouterLink],
  templateUrl: './design-card.component.html',
  styleUrl: './design-card.component.scss',
  host: { '[class.deleting]': 'deleting' },
})
export class DesignCardComponent {
  @Input({ required: true }) design!: DesignModel;
  // Shows the delete button (admin)
  @Input() deletable = false;
  @Input() deleting = false;
  // Shows the edit button: name, tags, categories (admin)
  @Input() editable = false;
  // Shows the "Use it" button under the image
  @Input() usable = false;
  @Output() remove = new EventEmitter<DesignModel>();
  // Edit clicked: the parent opens the edit dialog
  @Output() edit = new EventEmitter<DesignModel>();
  // Image clicked: the parent shows the preview
  @Output() open = new EventEmitter<DesignModel>();
  // "Use it" clicked: the parent opens the designer with this design
  @Output() use = new EventEmitter<DesignModel>();

  storeLink(creator: DesignCreator): string[] {
    return creatorLink(creator);
  }
}
