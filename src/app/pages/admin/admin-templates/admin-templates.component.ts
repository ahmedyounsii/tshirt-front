import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TemplatesPanelComponent } from '../../design-manage/components/templates-panel/templates-panel.component';
import {
  AdminToast,
  AdminToastComponent,
} from '../../design-manage/components/admin-toast/admin-toast.component';

// Admin: the templates (/admin/designs/templates), the blank products of the designer
@Component({
  selector: 'app-admin-templates',
  standalone: true,
  imports: [TemplatesPanelComponent, AdminToastComponent],
  template: `
    <app-templates-panel (notify)="showToast($event)" />
    @if (toast(); as toast) {
      <app-admin-toast [toast]="toast" />
    }
  `,
  styles: `
    :host {
      display: block;
      min-height: calc(100vh - var(--header-height));
      padding: 1rem 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTemplatesComponent {
  readonly toast = signal<AdminToast | null>(null);
  private toastTimeout?: ReturnType<typeof setTimeout>;

  showToast(toast: AdminToast) {
    this.toast.set(toast);
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toast.set(null), 3000);
  }
}
