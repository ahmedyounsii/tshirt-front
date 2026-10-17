import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface ConfirmOptions {
  header: string;
  message: string;
  acceptLabel?: string;
  acceptIcon?: string;
  // 'danger' for destructive actions (deletes)
  severity?: 'primary' | 'danger';
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (accepted: boolean) => void;
}

// Styled replacement for window.confirm(), rendered once by <app-confirm-dialog> in the app root
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private translate = inject(TranslateService);

  readonly request = signal<ConfirmRequest | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    // A pending request is answered "no" before the new one replaces it
    this.request()?.resolve(false);
    return new Promise((resolve) => this.request.set({ ...options, resolve }));
  }

  // Shortcut for the delete confirmations used across the app
  confirmDelete(message: string, header?: string): Promise<boolean> {
    return this.ask({
      header: header ?? this.translate.instant('confirm.delete'),
      message,
      acceptLabel: this.translate.instant('common.delete'),
      acceptIcon: 'pi pi-trash',
      severity: 'danger',
    });
  }

  close(accepted: boolean) {
    const request = this.request();
    if (!request) return;
    this.request.set(null);
    request.resolve(accepted);
  }
}
