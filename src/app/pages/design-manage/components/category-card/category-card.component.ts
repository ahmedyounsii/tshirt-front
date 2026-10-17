import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DesignCategoryModel } from '../../../../models/design-catergory.model';

@Component({
  selector: 'app-category-card',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './category-card.component.html',
  styleUrl: './category-card.component.scss',
})
export class CategoryCardComponent {
  @Input({ required: true }) category!: DesignCategoryModel;
  @Input() deleting = false;
  @Output() open = new EventEmitter<DesignCategoryModel>();
  @Output() add = new EventEmitter<DesignCategoryModel>();
  @Output() remove = new EventEmitter<DesignCategoryModel>();

  // Action buttons sit inside the clickable card: don't also trigger `open`
  onAction(event: Event, emitter: EventEmitter<DesignCategoryModel>) {
    event.stopPropagation();
    emitter.emit(this.category);
  }
}
