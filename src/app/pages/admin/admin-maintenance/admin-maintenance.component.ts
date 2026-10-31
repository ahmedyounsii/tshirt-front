import { Component, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MaintenanceService } from '../../../services/maintenance/maintenance.service';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';

// Bottom of the admin sidebar: whether the shop is open, and the button closing it to
// the public (maintenance) or reopening it, after a dialog telling what it does.
// Compact: the rail of the collapsed sidebar, a status colored button alone
@Component({
    selector: 'app-admin-maintenance',
    imports: [TranslatePipe, DialogComponent],
    templateUrl: './admin-maintenance.component.html',
    styleUrl: './admin-maintenance.component.scss',
    host: { '[class.compact]': 'compact()' }
})
export class AdminMaintenanceComponent {
  maintenance = inject(MaintenanceService);

  readonly compact = input(false);

  readonly confirmOpen = signal(false);
  // What the dialog offers, fixed when it opens: putting in maintenance or reopening
  readonly enabling = signal(true);
  readonly saving = signal(false);
  readonly error = signal(false);

  askToggle() {
    this.enabling.set(!this.maintenance.enabled());
    this.error.set(false);
    this.confirmOpen.set(true);
  }

  toggleMaintenance() {
    this.saving.set(true);
    this.error.set(false);
    this.maintenance.setEnabled(this.enabling()).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmOpen.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.error.set(true);
      },
    });
  }
}
