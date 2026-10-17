import { Injectable, signal } from '@angular/core';

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
  readonly request = signal<ConfirmRequest | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    // A pending request is answered "no" before the new one replaces it
    this.request()?.resolve(false);
    return new Promise((resolve) => this.request.set({ ...options, resolve }));
  }

  // Shortcut for the delete confirmations used across the app
  confirmDelete(message: string, header = 'Delete'): Promise<boolean> {
    return this.ask({
      header,
      message,
      acceptLabel: 'Delete',
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
