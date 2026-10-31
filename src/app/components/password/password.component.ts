import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  forwardRef,
  inject,
  Input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

export type PasswordStrength = 'weak' | 'medium' | 'strong';

// Strong: 8+ characters with lower case, upper case and a digit; medium: 6+ with two of them
const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const MEDIUM = /^(?:(?=.*[a-z])(?=.*[A-Z])|(?=.*[a-z])(?=.*\d)|(?=.*[A-Z])(?=.*\d)).{6,}$/;

export const passwordStrength = (value: string): PasswordStrength =>
  STRONG.test(value) ? 'strong' : MEDIUM.test(value) ? 'medium' : 'weak';

// Password field working with forms / [(ngModel)]: an eye button shows the text ([toggleMask]),
// a strength meter under the field while typing ([feedback], for new passwords)
@Component({
    selector: 'app-password',
    imports: [TranslatePipe],
    templateUrl: './password.component.html',
    styleUrl: './password.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
      {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => PasswordComponent),
        multi: true,
      },
    ],
    host: {
      '[class.fluid]': 'fluid',
    }
})
export class PasswordComponent implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);

  // Id of the input, for a <label for>
  @Input() inputId?: string;
  @Input() autocomplete = 'current-password';
  @Input() placeholder = '';
  @Input() feedback = false;
  @Input() toggleMask = false;
  @Input() disabled = false;
  // Stretches the field to the available width
  @Input() fluid = false;

  readonly value = signal('');
  readonly visible = signal(false);
  readonly strength = computed(() => passwordStrength(this.value()));

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  onInput(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
    this.onChange(this.value());
  }

  blur() {
    this.onTouched();
  }

  writeValue(value: string | null) {
    this.value.set(value ?? '');
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void) {
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
