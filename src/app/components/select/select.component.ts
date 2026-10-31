import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  contentChild,
  ElementRef,
  forwardRef,
  inject,
  Input,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PopoverComponent } from '../popover/popover.component';

let nextId = 0;

// Dropdown select working with [(ngModel)] / forms. [multiple] turns it into a multi select
// (array value, chips in the field, the list stays open).
// Options: objects read through optionLabel / optionValue, or plain values (label = value).
// Labels go through the translate pipe, so translation keys work as labels.
// Custom rendering: <ng-template #item let-option> (list) and <ng-template #selectedItem let-option> (field).
// The list opens in the top layer (app-popover), above dialogs too.
@Component({
    selector: 'app-select',
    imports: [NgTemplateOutlet, TranslatePipe, PopoverComponent],
    templateUrl: './select.component.html',
    styleUrl: './select.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
      {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => SelectComponent),
        multi: true,
      },
    ],
    host: {
      '[class.fluid]': 'fluid',
      '[class.disabled]': 'disabled',
      '[class.open]': 'popover().open()',
    }
})
export class SelectComponent<T = any> implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() set options(options: T[] | null | undefined) {
    this.optionList.set(options ?? []);
  }
  @Input() optionLabel?: string;
  @Input() optionValue?: string;
  @Input() placeholder = '';
  @Input() multiple = false;
  // Search field on top of the list
  @Input() filter = false;
  // × button emptying the value (single select)
  @Input() showClear = false;
  @Input() disabled = false;
  @Input() ariaLabel = '';
  // Id of the field, for a <label for>
  @Input() inputId?: string;
  // Stretches the field to the available width
  @Input() fluid = false;

  readonly itemTpl = contentChild<TemplateRef<{ $implicit: T }>>('item');
  readonly selectedItemTpl = contentChild<TemplateRef<{ $implicit: T }>>('selectedItem');
  readonly popover = viewChild.required(PopoverComponent);
  private trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly listId = `app-select-list-${nextId++}`;
  private optionList = signal<T[]>([]);
  private value = signal<unknown>(null);
  readonly query = signal('');
  readonly active = signal(-1);

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  readonly visibleOptions = computed(() => {
    const query = this.query().trim().toLowerCase();
    const options = this.optionList();
    if (!query) return options;
    return options.filter((o) => this.text(o).toLowerCase().includes(query));
  });

  readonly selectedOptions = computed(() => {
    const value = this.value();
    const options = this.optionList();
    if (this.multiple) {
      const values = Array.isArray(value) ? value : [];
      return options.filter((o) => values.includes(this.valueOf(o)));
    }
    const match = options.find((o) => this.valueOf(o) === value);
    return match === undefined ? [] : [match];
  });

  readonly hasValue = computed(() => this.selectedOptions().length > 0);

  labelOf(option: T): string {
    if (this.optionLabel && option && typeof option === 'object') {
      return String((option as Record<string, unknown>)[this.optionLabel] ?? '');
    }
    return String(option ?? '');
  }

  valueOf(option: T): unknown {
    if (this.optionValue && option && typeof option === 'object') {
      return (option as Record<string, unknown>)[this.optionValue];
    }
    return option;
  }

  isSelected(option: T): boolean {
    const value = this.value();
    const optionValue = this.valueOf(option);
    return this.multiple
      ? Array.isArray(value) && value.includes(optionValue)
      : value === optionValue;
  }

  optionId(index: number) {
    return `${this.listId}-${index}`;
  }

  // Translated label, what the filter searches
  private text(option: T): string {
    const label = this.labelOf(option);
    return label ? this.translate.instant(label) : '';
  }

  toggle() {
    if (this.disabled) return;
    if (this.popover().open()) this.close();
    else this.openList();
  }

  openList() {
    if (this.disabled || this.popover().open()) return;
    this.query.set('');
    const selected = this.optionList().findIndex((o) => this.isSelected(o));
    this.active.set(selected >= 0 ? selected : 0);
    this.popover().show(this.host.nativeElement);
    this.scrollActiveIntoView();
  }

  close() {
    this.popover().hide();
  }

  // The popover closed (selection, outside click, Escape): focus comes back to the field
  // unless the user clicked somewhere else
  onClosed() {
    this.query.set('');
    this.onTouched();
    const focused = this.host.nativeElement.ownerDocument.activeElement;
    if (!focused || focused === focused.ownerDocument.body || this.host.nativeElement.contains(focused)) {
      this.trigger().nativeElement.focus({ preventScroll: true });
    }
  }

  select(option: T) {
    const optionValue = this.valueOf(option);
    if (this.multiple) {
      const current = Array.isArray(this.value()) ? (this.value() as unknown[]) : [];
      this.emit(
        current.includes(optionValue)
          ? current.filter((v) => v !== optionValue)
          : [...current, optionValue],
      );
    } else {
      this.emit(optionValue);
      this.close();
    }
  }

  // × of a chip: removes it without opening the list
  remove(option: T, event: Event) {
    event.stopPropagation();
    if (this.disabled) return;
    const current = Array.isArray(this.value()) ? (this.value() as unknown[]) : [];
    this.emit(current.filter((v) => v !== this.valueOf(option)));
  }

  clear(event: Event) {
    event.stopPropagation();
    this.emit(this.multiple ? [] : null);
    this.trigger().nativeElement.focus();
  }

  onQuery(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  // Keyboard on the field or the search: arrows move in the list, Enter / Space pick
  onKeydown(event: KeyboardEvent) {
    const open = this.popover().open();
    const count = this.visibleOptions().length;
    const inSearch = event.target instanceof HTMLInputElement;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) return this.openList();
        if (!count) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.active.set((this.active() + step + count) % count);
        this.scrollActiveIntoView();
        return;
      }
      case 'Home':
      case 'End':
        if (!open || !count || inSearch) return;
        event.preventDefault();
        this.active.set(event.key === 'Home' ? 0 : count - 1);
        this.scrollActiveIntoView();
        return;
      case 'Enter':
      case ' ': {
        if (event.key === ' ' && inSearch) return;
        event.preventDefault();
        if (!open) return this.openList();
        const option = this.visibleOptions()[this.active()];
        if (option !== undefined) this.select(option);
        return;
      }
      case 'Tab':
        if (open) this.close();
        return;
    }
  }

  private scrollActiveIntoView() {
    // After the list renders
    requestAnimationFrame(() => {
      this.host.nativeElement.ownerDocument
        .getElementById(this.optionId(this.active()))
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  private emit(value: unknown) {
    this.value.set(value);
    this.onChange(value);
  }

  writeValue(value: unknown) {
    this.value.set(value ?? (this.multiple ? [] : null));
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: unknown) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean) {
    this.disabled = disabled;
    if (disabled && this.popover().open()) this.close();
    this.cdr.markForCheck();
  }
}
