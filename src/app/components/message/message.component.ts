import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type MessageSeverity = 'success' | 'info' | 'warn' | 'error';

const ICONS: Record<MessageSeverity, string> = {
  success: 'sp-icon sp-tick-circle',
  info: 'sp-icon sp-info-circle',
  warn: 'sp-icon sp-warning-triangle',
  error: 'sp-icon sp-close-circle',
};

// Inline feedback box: [text] or projected content, colored by its severity.
// Errors are announced right away (alert), the others politely (status)
@Component({
    selector: 'app-message',
    template: `
    <i [class]="icon" aria-hidden="true"></i>
    <span class="text">{{ text }}<ng-content /></span>
  `,
    styleUrl: './message.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
      '[attr.data-severity]': 'severity',
      '[attr.role]': "severity === 'error' ? 'alert' : 'status'",
    }
})
export class MessageComponent {
  @Input() severity: MessageSeverity = 'info';
  @Input() text = '';

  get icon(): string {
    return ICONS[this.severity] ?? ICONS.info;
  }
}
