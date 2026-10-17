import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type ConfigCategoryIconName =
  | 'select-design'
  | 'text-edition'
  | 'upload'
  | 'product-edition';

// Inline SVG icons of the config categories, keyed by category id
@Component({
  selector: 'app-config-category-icon',
  standalone: true,
  templateUrl: './config-category-icon.component.html',
  styleUrl: './config-category-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigCategoryIconComponent {
  @Input({ required: true }) name!: ConfigCategoryIconName | string;
}
