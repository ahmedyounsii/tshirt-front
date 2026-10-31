import { Component, Input } from '@angular/core';

export type AdminToast = {
  type: 'success' | 'error' | 'warn';
  message: string;
};

@Component({
  selector: 'app-admin-toast',
  standalone: true,
  template: `
    <i
      class="sp-icon"
      [class.sp-tick-circle]="toast.type === 'success'"
      [class.sp-warning-circle]="toast.type === 'error'"
      [class.sp-warning-circle]="toast.type === 'warn'"
    ></i>
    {{ toast.message }}
  `,
  styleUrl: './admin-toast.component.scss',
  host: {
    '[class.error]': "toast.type === 'error'",
    '[class.warn]': "toast.type === 'warn'",
  },
})
export class AdminToastComponent {
  @Input({ required: true }) toast!: AdminToast;
}
