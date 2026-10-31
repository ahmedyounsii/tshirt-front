import { Component, EventEmitter, Input, Output, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { DesignCreator, DesignModel } from '../../models/design.model';
import { creatorDisplayName, creatorLink } from '../../models/user.model';
import { TranslatePipe } from '@ngx-translate/core';
import { TagComponent } from '../tag/tag.component';

@Component({
  selector: 'app-design-card',
  standalone: true,
  imports: [TagComponent, TranslatePipe, ButtonModule, PopoverModule, NgTemplateOutlet, RouterLink],
  templateUrl: './design-card.component.html',
  styleUrl: './design-card.component.scss',
  host: { '[class.deleting]': 'deleting' },
})
export class DesignCardComponent {
  @Input({ required: true }) design!: DesignModel;
  // Shows "Delete" in the actions menu (admin or uploader)
  @Input() deletable = false;
  @Input() deleting = false;
  // Its visibility is being changed
  @Input() publishing = false;
  // Shows "Edit" (name, tags, categories) and "Hide" / "Make visible" in the actions menu
  @Input() editable = false;
  // Shows the "Use it" button under the image
  @Input() usable = false;
  @Output() remove = new EventEmitter<DesignModel>();
  // Edit clicked: the parent opens the edit dialog
  @Output() edit = new EventEmitter<DesignModel>();
  // "Hide" / "Make visible" picked: the parent shows or hides it in the gallery
  @Output() toggleVisibility = new EventEmitter<DesignModel>();
  // Image clicked: the parent shows the preview
  @Output() open = new EventEmitter<DesignModel>();
  // "Use it" clicked: the parent opens the designer with this design
  @Output() use = new EventEmitter<DesignModel>();

  // Actions popover, opened by the "..." button of the footer or the toolbar
  readonly menu = viewChild<Popover>('actionsPopover');

  storeLink(creator: DesignCreator): string[] {
    return creatorLink(creator);
  }

  // Their open store's name, else their username
  readonly creatorName = creatorDisplayName;
}
