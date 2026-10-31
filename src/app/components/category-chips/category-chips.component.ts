import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { DesignCategoryModel } from '../../models/design-catergory.model';
import { TranslatePipe } from '@ngx-translate/core';

export type ChipItem = {
  id: string;
  label: string;
  // Hidden when missing
  count?: number;
};

// Chips of design categories, "All" first, counting the designs of each category
export const toCategoryChips = (
  categories: DesignCategoryModel[],
  allId: string,
  allCount?: number,
): ChipItem[] => [
  { id: allId, label: 'common.all', count: allCount },
  ...categories.map((c) => ({
    id: c._id,
    label: c.label,
    count: c.designs?.length || 0,
  })),
];

// Single choice filter chips (categories, product owners...)
@Component({
    selector: 'app-category-chips',
    imports: [TranslatePipe],
    templateUrl: './category-chips.component.html',
    styleUrl: './category-chips.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryChipsComponent {
  @Input() items: ChipItem[] = [];
  @Input() selected = '';
  @Output() selectedChange = new EventEmitter<string>();

  select(id: string) {
    if (id !== this.selected) this.selectedChange.emit(id);
  }
}
