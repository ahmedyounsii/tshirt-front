import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdminUsersComponent } from '../../../components/admin-users/admin-users.component';

// Super admin only: names the admins and removes them, in the admin view
@Component({
    selector: 'app-admin-admins',
    imports: [AdminUsersComponent],
    template: `<app-admin-users />`,
    styles: `
    :host {
      display: block;
      min-height: calc(100vh - var(--header-height));
      padding: 1rem 0;
    }
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAdminsComponent {}
