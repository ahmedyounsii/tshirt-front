import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';
import { DesignCategoryModel } from '../../models/design-catergory.model';

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
  { id: allId, label: 'All', count: allCount },
  ...categories.map((c) => ({
    id: c._id,
    label: c.label,
    count: c.designs?.length || 0,
  })),
];

// Single choice filter chips (categories, tshirt owners...)
@Component({
  selector: 'app-category-chips',
  standalone: true,
  imports: [SkeletonModule],
  templateUrl: './category-chips.component.html',
  styleUrl: './category-chips.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryChipsComponent {
  @Input() items: ChipItem[] = [];
  @Input() selected = '';
  // Shows skeleton chips instead of the items
  @Input() loading = false;
  @Output() selectedChange = new EventEmitter<string>();

  readonly skeletonWidths = [64, 104, 96, 112];

  select(id: string) {
    if (id !== this.selected) this.selectedChange.emit(id);
  }
}
