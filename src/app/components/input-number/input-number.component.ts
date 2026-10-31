import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnChanges,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

// Number field working with [(ngModel)] / forms: the value is a number, or null when empty.
// Shows the plain number while editing, then formats it on blur (fraction digits, grouping,
// prefix / suffix, e.g. a currency) and keeps it within min / max. Arrow up / down step it.
@Component({
    selector: 'app-input-number',
    templateUrl: './input-number.component.html',
    styleUrl: './input-number.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
      {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => InputNumberComponent),
        multi: true,
      },
    ],
    host: {
      '[class.fluid]': 'fluid',
    }
})
export class InputNumberComponent implements ControlValueAccessor, OnChanges {
  @Input() min?: number;
  @Input() max?: number;
  @Input() step = 1;
  @Input() minFractionDigits?: number;
  @Input() maxFractionDigits?: number;
  @Input() useGrouping = true;
  @Input() locale = 'en-US';
  @Input() prefix = '';
  @Input() suffix = '';
  @Input() placeholder = '';
  @Input() ariaLabel = '';
  // Id of the input, for a <label for>
  @Input() inputId?: string;
  // Extra classes of the input
  @Input() inputClass = '';
  @Input() autofocus = false;
  @Input() disabled = false;
  // Stretches the field to the available width
  @Input() fluid = false;

  private input = viewChild<ElementRef<HTMLInputElement>>('input');
  private value: number | null = null;
  private focused = false;

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    afterNextRender(() => {
      this.render();
      if (this.autofocus) this.input()?.nativeElement.focus();
    });
  }

  // Format inputs (digits, affixes...) changed: redraw the shown value
  ngOnChanges() {
    if (!this.focused) this.render();
  }

  // Digits allowed after the point: maxFractionDigits, or the Intl default (3)
  private get fractionDigits(): number {
    return this.maxFractionDigits ?? Math.max(3, this.minFractionDigits ?? 0);
  }

  private format(value: number): string {
    const formatter = new Intl.NumberFormat(this.locale, {
      minimumFractionDigits: Math.min(this.minFractionDigits ?? 0, this.fractionDigits),
      maximumFractionDigits: this.fractionDigits,
      useGrouping: this.useGrouping,
    });
    return `${this.prefix}${formatter.format(value)}${this.suffix}`;
  }

  // Shown value: formatted when idle, the plain number while editing
  private render() {
    const el = this.input()?.nativeElement;
    if (!el) return;
    if (this.value === null) el.value = '';
    else el.value = this.focused ? String(this.value) : this.format(this.value);
  }

  private clamp(value: number): number {
    if (this.min !== undefined && value < this.min) return this.min;
    if (this.max !== undefined && value > this.max) return this.max;
    return value;
  }

  private round(value: number): number {
    const factor = 10 ** this.fractionDigits;
    return Math.round(value * factor) / factor;
  }

  private emit(value: number | null) {
    if (value === this.value) return;
    this.value = value;
    this.onChange(value);
  }

  onFocus() {
    this.focused = true;
    this.render();
  }

  // Keeps digits, one point (when decimals are allowed) and a leading minus (when min allows it),
  // cuts the extra decimals, and emits the number as typed
  onInput() {
    const el = this.input()?.nativeElement;
    if (!el) return;
    const allowMinus = this.min === undefined || this.min < 0;
    let text = el.value.replace(/,/g, '.').replace(/[^\d.-]/g, '');
    const negative = allowMinus && text.startsWith('-');
    text = text.replace(/-/g, '');
    const [whole, ...rest] = text.split('.');
    const decimals = rest.join('').slice(0, this.fractionDigits);
    text = (negative ? '-' : '') + whole + (rest.length && this.fractionDigits > 0 ? '.' + decimals : '');
    if (text !== el.value) el.value = text;

    const parsed = parseFloat(text);
    this.emit(Number.isNaN(parsed) ? null : parsed);
  }

  onBlur() {
    this.focused = false;
    if (this.value !== null) this.emit(this.round(this.clamp(this.value)));
    this.render();
    this.onTouched();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const delta = event.key === 'ArrowUp' ? this.step : -this.step;
    this.emit(this.round(this.clamp((this.value ?? 0) + delta)));
    this.render();
  }

  writeValue(value: number | null) {
    this.value = value ?? null;
    this.render();
  }

  registerOnChange(fn: (value: number | null) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean) {
    this.disabled = disabled;
  }
}
