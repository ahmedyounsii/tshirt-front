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
};

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
      '[attr.aria-label]': 'ariaLabel || null',
    }
})
export class SelectButtonComponent<T = string> {
  @Input() options: SelectButtonOption<T>[] = [];
  @Input() value: T | null = null;
  @Input() ariaLabel = '';
  // Stretches the buttons to fill the available width
  @Input() fluid = false;
  @Output() valueChange = new EventEmitter<T>();

  select(value: T) {
    if (value !== this.value) this.valueChange.emit(value);
  }
}
