import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export type SelectButtonOption<T = string> = {
  // Translation key (or plain text)
  label: string;
  value: T;
  // PrimeIcons class shown before the label
  icon?: string;
  // Badge after the label, hidden when 0 or missing
  count?: number;
};

// Builds options from values, labelled by a translation key per value
export const toSelectOptions = <T>(
  values: readonly T[],
  label: (value: T) => string,
): SelectButtonOption<T>[] => values.map((value) => ({ value, label: label(value) }));

// Single choice segmented control made of native buttons
@Component({
    selector: 'app-selectbutton',
    imports: [TranslatePipe],
    templateUrl: './selectbutton.component.html',
    styleUrl: './selectbutton.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
      role: 'group',
      '[class.fluid]': 'fluid',
      '[class.vertical]': "layout === 'vertical'",
      '[attr.aria-label]': 'ariaLabel || null',
    }
})
export class SelectButtonComponent<T = string> {
  @Input() options: SelectButtonOption<T>[] = [];
  @Input() value: T | null = null;
  @Input() ariaLabel = '';
  // Stretches the buttons to fill the available width
  @Input() fluid = false;
  // Vertical: the icon stacked above the label, e.g. light / dark / system
  @Input() layout: 'horizontal' | 'vertical' = 'horizontal';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<T>();

  select(value: T) {
    if (value !== this.value) this.valueChange.emit(value);
  }
}
