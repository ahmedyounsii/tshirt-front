import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [TranslatePipe, DialogModule, ButtonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  confirm = inject(ConfirmService);

  // Closing with the X, Escape or the mask counts as "Cancel"
  onVisibleChange(visible: boolean) {
    if (!visible) this.confirm.close(false);
  }
}
