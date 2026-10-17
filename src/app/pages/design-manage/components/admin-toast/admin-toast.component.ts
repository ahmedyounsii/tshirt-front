import { Component, Input } from '@angular/core';

export type AdminToast = { type: 'success' | 'error'; message: string };

@Component({
  selector: 'app-admin-toast',
  standalone: true,
  template: `
    <i
      class="pi"
      [class.pi-check-circle]="toast.type === 'success'"
      [class.pi-exclamation-circle]="toast.type === 'error'"
    ></i>
    {{ toast.message }}
  `,
  styleUrl: './admin-toast.component.scss',
  host: { '[class.error]': "toast.type === 'error'" },
})
export class AdminToastComponent {
  @Input({ required: true }) toast!: AdminToast;
}
