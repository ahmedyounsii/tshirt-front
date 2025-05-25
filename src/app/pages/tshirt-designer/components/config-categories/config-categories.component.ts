import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { configCategories } from '../../../../shared/config-categories';

@Component({
  selector: 'app-config-categories',
  standalone: true,
  imports: [],
  templateUrl: './config-categories.component.html',
  styleUrl: './config-categories.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigCategoriesComponent {
  @Output() doSelectConfigCategory = new EventEmitter<any>();

  configCategories = configCategories;

  selectCategory(item: any) {
    this.doSelectConfigCategory.emit(item);
  }
}
