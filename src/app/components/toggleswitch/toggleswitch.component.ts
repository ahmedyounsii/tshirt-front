import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  inject,
  Input,
  Output,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

// Native on/off switch (a checkbox with the switch role). Works with [(ngModel)] / forms,
// or standalone with [checked] and (checkedChange). A wrapping <label> toggles it.
@Component({
    selector: 'app-toggleswitch',
    templateUrl: './toggleswitch.component.html',
    styleUrl: './toggleswitch.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
      {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => ToggleSwitchComponent),
        multi: true,
      },
    ],
})
export class ToggleSwitchComponent implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);

  @Input() checked = false;
  @Input() disabled = false;
  @Input() ariaLabel = '';
  @Output() checkedChange = new EventEmitter<boolean>();

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  toggle(event: Event) {
    this.checked = (event.target as HTMLInputElement).checked;
    this.onChange(this.checked);
    this.checkedChange.emit(this.checked);
  }

  blur() {
    this.onTouched();
  }

  writeValue(value: boolean | null) {
    this.checked = !!value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: boolean) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean) {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }
}
