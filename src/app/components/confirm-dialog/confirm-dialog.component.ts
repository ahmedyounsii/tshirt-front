import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';

@Component({
    selector: 'app-confirm-dialog',
    imports: [TranslatePipe, DialogComponent, ButtonModule],
    templateUrl: './confirm-dialog.component.html',
    styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {
  confirm = inject(ConfirmService);

  // Closing with the X, Escape or the mask counts as "Cancel"
  onOpenChange(open: boolean) {
    if (!open) this.confirm.close(false);
  }
}
