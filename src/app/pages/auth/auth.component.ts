import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../services/auth/auth.service';
import { LanguageService } from '../../services/language.service';
import { AuthResponse } from '../../models/user.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

type AuthMode = 'login' | 'register';

// Same rules as the server (routes/authRoutes.js)
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirmPassword')?.value
    ? null
    : { passwordsMismatch: true };

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    SelectButtonModule,
    MessageModule,
  ],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  // The select button shows plain labels: recomputed when the language changes
  readonly modes = computed(() => {
    this.language.current();
    return [
      { label: this.translate.instant('common.signIn'), value: 'login' },
      { label: this.translate.instant('auth.createAccount'), value: 'register' },
    ];
  });

  mode = signal<AuthMode>('login');
  loading = signal(false);
  error = signal<string | null>(null);

  loginForm = this.fb.nonNullable.group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });

  registerForm = this.fb.nonNullable.group(
    {
      name: ['', Validators.required],
      username: ['', [Validators.required, Validators.pattern(USERNAME_PATTERN)]],
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)],
      ],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  ngOnInit(): void {
    // /auth?mode=register opens the registration form directly
    if (this.route.snapshot.queryParamMap.get('mode') === 'register') {
      this.mode.set('register');
    }
  }

  setMode(mode: AuthMode): void {
    if (!mode) return;
    this.mode.set(mode);
    this.error.set(null);
  }

  // Shows a field's error once the user has interacted with it
  invalid(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const { login, password } = this.loginForm.getRawValue();
    this.submit(this.auth.login({ login: login.trim(), password }));
  }

  submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const { name, username, email, password } = this.registerForm.getRawValue();
    this.submit(
      this.auth.register({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      }),
    );
  }

  private submit(request: Observable<AuthResponse>): void {
    this.loading.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl(this.returnUrl());
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          err.status === 0
            ? this.translate.instant('auth.serverUnreachable')
            : err.error?.message ||
                this.translate.instant('auth.genericError'),
        );
      },
    });
  }

  // Only same-site paths: "//evil.com" or "https://..." would redirect off the site
  private returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')
      ? url
      : '/';
  }
}
