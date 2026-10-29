import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth/auth.service';
import { UsersService } from '../../services/users/users.service';
import { UniqueUserField, UpdateAccountPayload, UserModel } from '../../models/user.model';

// Same rules as the server (models/User.js)
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;

type SettingsTab = 'account' | 'security';
type Availability = 'checking' | 'available' | 'taken';
type Feedback = { severity: 'success' | 'error'; text: string };

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('newPassword')?.value === group.get('confirmPassword')?.value
    ? null
    : { passwordsMismatch: true };

// Account settings of the logged in user, one tab each (kept in the address, "?tab="):
// name, username and email, then the password (the super admin names the admins in /admin/admins).
// The username and email are unique: they are checked with the server when a field is left
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private auth = inject(AuthService);
  private users = inject(UsersService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  private tabParam = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('tab'))),
    { initialValue: null },
  );
  // Account unless the address asks for another tab the user can open
  readonly tab = computed((): SettingsTab => {
    const tab = this.tabParam();
    if (tab === 'security') return 'security';
    return 'account';
  });

  accountForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    username: ['', [Validators.required, Validators.pattern(USERNAME_PATTERN)]],
    email: ['', [Validators.required, Validators.email]],
  });

  passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  // Result of the last uniqueness check of each field, cleared as soon as it is edited
  availability = signal<Partial<Record<UniqueUserField, Availability>>>({});
  savingAccount = signal(false);
  savingPassword = signal(false);
  accountFeedback = signal<Feedback | null>(null);
  passwordFeedback = signal<Feedback | null>(null);

  private accountValue = toSignal(
    this.accountForm.valueChanges.pipe(startWith(this.accountForm.value)),
    { requireSync: true },
  );

  // Only the fields that differ from the saved account are sent
  private changes = computed((): UpdateAccountPayload => {
    this.accountValue();
    const user = this.auth.user();
    if (!user) return {};
    const { name, username, email } = this.accountForm.getRawValue();
    const changes: UpdateAccountPayload = {};
    if (name.trim() !== user.name) changes.name = name.trim();
    if (username.trim().toLowerCase() !== (user.username ?? '')) {
      changes.username = username.trim().toLowerCase();
    }
    if (email.trim().toLowerCase() !== user.email) changes.email = email.trim().toLowerCase();
    return changes;
  });
  hasChanges = computed(() => Object.keys(this.changes()).length > 0);
  checking = computed(() => Object.values(this.availability()).includes('checking'));

  constructor() {
    // Filled from the account, and again once it is refreshed or saved (unless being edited)
    effect(() => {
      const user = this.auth.user();
      if (user) untracked(() => !this.accountForm.dirty && this.fillAccount(user));
    });

    // Editing a field drops its last check: it is checked again when left
    for (const field of ['username', 'email'] as const) {
      this.accountForm.controls[field].valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.setAvailability(field, undefined));
    }
    // Typing again hides the last message (not the reset that follows a save)
    this.accountForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.accountForm.dirty && this.accountFeedback.set(null));
    this.passwordForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.passwordForm.dirty && this.passwordFeedback.set(null));
  }

  // Shows a field's error once the user has interacted with it
  invalid(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  // On blur: asks the server whether a valid, changed username or email is free
  checkAvailability(field: UniqueUserField): void {
    const control = this.accountForm.controls[field];
    const value = control.value.trim().toLowerCase();
    if (control.invalid || !(field in this.changes())) return;

    this.setAvailability(field, 'checking');
    this.users.isAvailable(field, value).subscribe({
      next: (available) => {
        // Edited again meanwhile: that value gets its own check
        if (control.value.trim().toLowerCase() !== value) return;
        this.setAvailability(field, available ? 'available' : 'taken');
        if (!available) control.setErrors({ ...control.errors, taken: true });
      },
      // Unknown: the server checks again on save
      error: () => this.setAvailability(field, undefined),
    });
  }

  saveAccount(): void {
    if (this.accountForm.invalid || this.checking()) {
      this.accountForm.markAllAsTouched();
      return;
    }
    if (!this.hasChanges()) return;

    this.savingAccount.set(true);
    this.users.updateAccount(this.changes()).subscribe({
      next: (user) => {
        this.savingAccount.set(false);
        this.auth.setUser(user);
        this.fillAccount(user);
        this.accountFeedback.set({
          severity: 'success',
          text: this.translate.instant('settings.accountSaved'),
        });
      },
      error: (err: HttpErrorResponse) => {
        this.savingAccount.set(false);
        // Taken by someone else since the check: flagged on its field
        if (err.status === 409) {
          const field: UniqueUserField = /username/i.test(err.error?.message)
            ? 'username'
            : 'email';
          const control = this.accountForm.controls[field];
          this.setAvailability(field, 'taken');
          control.setErrors({ ...control.errors, taken: true });
          control.markAsTouched();
          return;
        }
        this.accountFeedback.set({ severity: 'error', text: this.errorText(err) });
      },
    });
  }

  savePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.savingPassword.set(true);
    this.users.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.passwordFeedback.set({
          severity: 'success',
          text: this.translate.instant('settings.passwordSaved'),
        });
      },
      error: (err: HttpErrorResponse) => {
        this.savingPassword.set(false);
        this.passwordFeedback.set({
          severity: 'error',
          text:
            err.status === 400 && /current password/i.test(err.error?.message)
              ? this.translate.instant('settings.wrongPassword')
              : this.errorText(err),
        });
      },
    });
  }

  private fillAccount(user: UserModel): void {
    this.accountForm.reset({
      name: user.name,
      username: user.username ?? '',
      email: user.email,
    });
  }

  private setAvailability(field: UniqueUserField, state: Availability | undefined): void {
    this.availability.update((all) => ({ ...all, [field]: state }));
  }

  private errorText(err: HttpErrorResponse): string {
    return err.status === 0
      ? this.translate.instant('auth.serverUnreachable')
      : err.error?.message || this.translate.instant('auth.genericError');
  }
}
