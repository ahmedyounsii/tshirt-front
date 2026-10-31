import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { MessageComponent } from '../message/message.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth/auth.service';
import { UsersService } from '../../services/users/users.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { UserModel, UserRole } from '../../models/user.model';
import { SearchInputComponent } from '../search-input/search-input.component';
import { TagComponent } from '../tag/tag.component';
import { AvatarUrlPipe } from '../../shared/avatar-url.pipe';

// Admins section of the settings (super admin only): the current admins, or the users matching
// the search, each one made an admin or a regular user again. The super admin's role never changes
@Component({
    selector: 'app-admin-users',
    imports: [TranslatePipe, MessageComponent, SearchInputComponent, TagComponent, AvatarUrlPipe],
    templateUrl: './admin-users.component.html',
    styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit {
  private users = inject(UsersService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmService);
  private translate = inject(TranslateService);

  readonly me = this.auth.user;

  search = signal('');
  // The admins while the search is empty, else the users matching it
  list = signal<UserModel[]>([]);
  loading = signal(true);
  // User whose role is being changed
  savingId = signal<string | null>(null);
  error = signal('');

  private request?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    this.load();
  }

  onSearch(value: string): void {
    this.search.set(value.trim());
    this.load();
  }

  async setRole(user: UserModel, role: UserRole): Promise<void> {
    const params = { name: this.displayName(user) };
    const accepted = await this.confirm.ask(
      role === 'admin'
        ? {
            header: this.translate.instant('settings.makeAdmin'),
            message: this.translate.instant('settings.makeAdminConfirm', params),
            acceptLabel: this.translate.instant('settings.makeAdmin'),
            acceptIcon: 'sp-icon sp-shield-1',
          }
        : {
            header: this.translate.instant('settings.removeAdmin'),
            message: this.translate.instant('settings.removeAdminConfirm', params),
            acceptLabel: this.translate.instant('settings.removeAdmin'),
            acceptIcon: 'sp-icon sp-close',
            severity: 'danger',
          },
    );
    if (!accepted) return;

    this.error.set('');
    this.savingId.set(user._id);
    this.users.setRole(user._id, role).subscribe({
      next: (updated) => {
        this.savingId.set(null);
        this.list.update((list) =>
          list
            .map((each) => (each._id === updated._id ? updated : each))
            // The admins list drops whoever is no longer one
            .filter((each) => this.search() || each.role === 'admin'),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.savingId.set(null);
        this.error.set(
          err.status === 0
            ? this.translate.instant('auth.serverUnreachable')
            : err.error?.code === 'isSeller'
              ? this.translate.instant('settings.sellerCantBeAdmin', params)
              : err.error?.message || this.translate.instant('auth.genericError'),
        );
      },
    });
  }

  displayName(user: UserModel): string {
    return user.name || (user.username ? `@${user.username}` : user.email);
  }

  initials(user: UserModel): string {
    return this.displayName(user)
      .replace(/^@/, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }

  private load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    const search = this.search();
    this.request = this.users.searchUsers(search, search ? undefined : 'admin').subscribe({
      next: (users) => {
        this.list.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.list.set([]);
        this.loading.set(false);
        this.error.set(this.translate.instant('auth.genericError'));
      },
    });
  }
}
