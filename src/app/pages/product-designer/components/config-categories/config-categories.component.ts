import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { configCategories } from '../../../../shared/config-categories';
import { ConfigCategoryIconComponent } from './components';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-config-categories',
    imports: [TranslatePipe, ConfigCategoryIconComponent],
    templateUrl: './config-categories.component.html',
    styleUrl: './config-categories.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfigCategoriesComponent {
  // Id of the open category, highlighted in the rail
  @Input() selectedId: string | null = null;
  @Output() doSelectConfigCategory = new EventEmitter<any>();

  configCategories = configCategories;

  selectCategory(item: any) {
    this.doSelectConfigCategory.emit(item);
  }
}
