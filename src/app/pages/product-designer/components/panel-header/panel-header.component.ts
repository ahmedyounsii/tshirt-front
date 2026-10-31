import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

// Header of the designer config panels: title, short description and close button
@Component({
    selector: 'app-panel-header',
    template: `
    <div class="panel-header-text">
      <span class="panel-header-title">{{ title }}</span>
      @if (description) {
        <span class="panel-header-description">{{ description }}</span>
      }
    </div>
    <button
      class="app-btn app-btn-sm app-btn-danger app-btn-text app-btn-icon-only"
      (click)="doClose.emit()"
    >
      <i class="pi pi-times" aria-hidden="true"></i>
    </button>
  `,
    styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      flex-shrink: 0;
    }
    .panel-header-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .panel-header-title {
      font-size: 20px;
      line-height: 28px;
      font-weight: 600;
    }
    .panel-header-description {
      font-size: 14px;
      color: var(--sp-surface-500);
    }
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PanelHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() description = '';
  @Output() doClose = new EventEmitter<void>();
}
