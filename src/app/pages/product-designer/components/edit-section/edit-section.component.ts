import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injectable,
  Input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon.component';

// Last section opened, kept while the page is open: the panels are recreated on each selection
let rememberedSection: string | null = null;

// The sections of one panel: only one is open at a time
@Injectable()
export class EditAccordion {
  private keys = new Set<string>();
  private defaultKey: string | null = null;
  // Picked in this panel; null once the user folded it, undefined until then
  private picked = signal<string | null | undefined>(undefined);

  register(key: string, isDefault: boolean) {
    this.keys.add(key);
    if (isDefault) this.defaultKey ??= key;
  }

  unregister(key: string) {
    this.keys.delete(key);
  }

  isOpen(key: string): boolean {
    const picked = this.picked();
    if (picked !== undefined) return picked === key;
    // The section opened last, when this panel has it
    const remembered =
      rememberedSection && this.keys.has(rememberedSection)
        ? rememberedSection
        : this.defaultKey;
    return remembered === key;
  }

  toggle(key: string) {
    const next = this.isOpen(key) ? null : key;
    this.picked.set(next);
    if (next) rememberedSection = next;
  }
}

// Joins the accordion of the panel it is in, or starts one
export const provideEditAccordion = () => ({
  provide: EditAccordion,
  useFactory: () =>
    inject(EditAccordion, { skipSelf: true, optional: true }) ??
    new EditAccordion(),
});

// Collapsible card of the edition panels, same header as the shortcuts card
@Component({
    selector: 'app-edit-section',
    imports: [IconComponent],
    template: `
    <button
      type="button"
      class="section-toggle"
      [attr.aria-expanded]="open"
      [attr.aria-controls]="bodyId"
      (click)="toggle()"
    >
      <app-icon size="xs" [icon]="icon" />
      <span class="section-toggle-title">{{ title }}</span>
      <i class="sp-icon sp-chevron-down section-toggle-chevron"></i>
    </button>
    @if (open) {
      <div class="section-body" [id]="bodyId">
        <ng-content />
      </div>
    }
  `,
    styles: `
    :host {
      display: block;
      flex-shrink: 0;
      border-radius: var(--card-radius);
      border: var(--global-border);
      background: var(--tool-surface, var(--sp-surface-100));
      overflow: hidden;
    }

    .section-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 12px;
      border: none;
      background: none;
      color: var(--sp-surface-700);
      font: inherit;
      text-align: left;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--sp-primary-500);
        outline-offset: -2px;
        border-radius: var(--button-radius);
      }

      &-title {
        flex: 1;
        font-size: 14px;
        font-weight: 600;
      }

      &-chevron {
        font-size: 12px;
        color: var(--sp-surface-500);
        transition: transform 0.2s;

        // Points up while open: clicking folds the card
        [aria-expanded='true'] > & {
          transform: rotate(180deg);
        }
      }

      &:hover &-chevron {
        color: var(--sp-surface-700);
      }
    }

    .section-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0px 14px 14px;
    }
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditSectionComponent implements OnInit, OnDestroy {
  private accordion = inject(EditAccordion);

  // Identifies the section across panels, for the one left open
  @Input({ required: true }) key!: string;
  @Input({ required: true }) title!: string;
  @Input() icon = '';
  // Opened when the panel shows, unless the last opened section is in it
  @Input() defaultOpen = false;

  ngOnInit(): void {
    this.accordion.register(this.key, this.defaultOpen);
  }

  ngOnDestroy(): void {
    this.accordion.unregister(this.key);
  }

  get open(): boolean {
    return this.accordion.isOpen(this.key);
  }

  get bodyId(): string {
    return `edit-section-${this.key}`;
  }

  toggle() {
    this.accordion.toggle(this.key);
  }
}
