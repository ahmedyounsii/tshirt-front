import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// - 2 + : used by the "Shop now" dialog, the cart drawer and the checkout
@Component({
    selector: 'app-qty-stepper',
    imports: [TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[class.qty-sm]': "size === 'small'" },
    template: `
    <button
      type="button"
      class="qty-btn"
      [class.qty-btn-remove]="isRemove"
      [disabled]="disabled || value <= min"
      [attr.aria-label]="'cart.decrease' | translate"
      (click)="change(value - 1)"
    >
      <i [class]="isRemove ? 'pi pi-trash' : 'pi pi-minus'"></i>
    </button>
    <span class="qty-value" aria-live="polite">{{ value }}</span>
    <button
      type="button"
      class="qty-btn"
      [disabled]="disabled || value >= max"
      [attr.aria-label]="'cart.increase' | translate"
      (click)="change(value + 1)"
    >
      <i class="pi pi-plus"></i>
    </button>
  `,
    styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border: var(--global-border);
      border-radius: calc(var(--button-radius) + 6px);
      background: var(--p-app-surface-0);
      --qty-btn-size: auto;
    }
    :host(.qty-sm) {
      --qty-btn-size: auto;
    }
    .qty-btn {
      display: grid;
      place-items: center;
      width: var(--qty-btn-size);
      height: var(--qty-btn-size);
      border: none;
      border-radius: var(--button-radius);
      background: transparent;
      color: var(--p-app-surface-700);
      font-size: 0.7rem;
      transition:
        background 0.15s ease,
        color 0.15s ease;

      i {
        font-size: 0.875rem;
      }

      &:hover:not(:disabled) {
        color: var(--p-app-primary-500);
      }
      &.qty-btn-remove:hover:not(:disabled) {
        color: var(--p-red-500);
      }

      &:disabled {
        opacity: 0.35;
        cursor: default;
      }
    }
    .qty-value {
      min-width: 22px;
      text-align: center;
      font-weight: 700;
      font-size: 0.875rem;
      font-variant-numeric: tabular-nums;
    }
  `
})
export class QtyStepperComponent {
  @Input() value = 1;
  @Input() min = 1;
  @Input() max = 20;
  @Input() size: 'normal' | 'small' = 'normal';
  @Input() disabled = false;
  // The minus button turns into a trash icon at 1 (min must then be 0)
  @Input() removable = false;

  @Output() valueChange = new EventEmitter<number>();

  get isRemove(): boolean {
    return this.removable && this.value <= 1;
  }

  change(value: number) {
    if (value < this.min || value > this.max) return;
    this.valueChange.emit(value);
  }
}
