import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="login-shell">
      <article class="login-card">
        <h2>Crear cuenta</h2>
        <p>Regístrate para comenzar a rastrear precios.</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <label>
            Nombre (opcional)
            <input type="text" formControlName="name" placeholder="Tu nombre" autocomplete="name" />
          </label>

          <label>
            Email
            <input type="email" formControlName="email" placeholder="tu@email.com" autocomplete="email" />
            <span class="field-error"
              *ngIf="form.get('email')?.touched && form.get('email')?.errors?.['required']">
              El email es obligatorio.
            </span>
            <span class="field-error"
              *ngIf="form.get('email')?.touched && form.get('email')?.errors?.['email']">
              Formato de email no válido.
            </span>
          </label>

          <label>
            Contraseña
            <input type="password" formControlName="password" placeholder="Mín. 8 caracteres" autocomplete="new-password" />
            <span class="hint">Mínimo 8 caracteres, 1 mayúscula, 1 número y 1 símbolo.</span>
            <span class="field-error"
              *ngIf="form.get('password')?.touched && form.get('password')?.errors?.['minlength']">
              Mínimo 8 caracteres.
            </span>
            <span class="field-error"
              *ngIf="form.get('password')?.touched && form.get('password')?.errors?.['passwordPolicy']">
              Debe incluir 1 mayúscula, 1 número y 1 símbolo.
            </span>
          </label>

          <label>
            Confirmar contraseña
            <input type="password" formControlName="confirmPassword" placeholder="Repite tu contraseña" autocomplete="new-password" />
            <span class="field-error"
              *ngIf="form.errors?.['passwordMismatch'] && form.get('confirmPassword')?.touched">
              Las contraseñas no coinciden.
            </span>
          </label>

          <p *ngIf="error" class="error">{{ error }}</p>

          <button type="submit" [disabled]="loading">
            {{ loading ? 'Registrando…' : 'Crear cuenta' }}
          </button>
        </form>

        <button type="button" class="google" (click)="onGoogle()" [disabled]="loading">
          Continuar con Google
        </button>

        <p class="links">
          ¿Ya tienes cuenta?
          <a routerLink="/login">Inicia sesión</a>
        </p>
      </article>
    </section>
  `,
  styles: [`
    .login-shell {
      min-height: calc(100vh - 100px);
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .login-card {
      width: min(420px, 100%);
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 32px 24px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }

    h2 { margin: 0 0 8px; font-size: 1.5rem; }
    p { margin: 0 0 16px; color: #4b5563; }

    form { display: grid; gap: 14px; }

    label {
      display: grid;
      gap: 5px;
      font-weight: 600;
      color: #1f2937;
      font-size: 0.875rem;
    }

    input {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,.1); }

    .hint {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .field-error {
      font-size: 0.75rem;
      color: #b91c1c;
      font-weight: 400;
    }

    .error {
      color: #b91c1c;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 0.875rem;
      margin: 0;
    }

    button[type="submit"] {
      margin-top: 4px;
      border: none;
      border-radius: 10px;
      padding: 11px 12px;
      background: #1d4ed8;
      color: #fff;
      font-weight: 600;
      font-size: 0.9375rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    button[type="submit"]:hover:not(:disabled) { background: #1e40af; }
    button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }

    .google {
      margin-top: 10px;
      width: 100%;
      border-radius: 10px;
      padding: 10px 12px;
      background: #fff;
      color: #111827;
      border: 1px solid #e5e7eb;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .google:hover:not(:disabled) { background: #f9fafb; }
    .google:disabled { opacity: 0.6; cursor: not-allowed; }

    .links {
      margin-top: 12px;
      font-size: 0.875rem;
      color: #6b7280;
    }
    .links a { color: #1d4ed8; font-weight: 500; text-decoration: none; }
    .links a:hover { text-decoration: underline; }
  `]
})
export class RegisterComponent {
  loading = false;
  error: string | null = null;
  readonly form;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.form = this.formBuilder.group(
      {
        name: [''],
        email: ['', [Validators.required, Validators.email]],
        password: [
          '',
          [Validators.required, Validators.minLength(8), this.passwordPolicyValidator]
        ],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: [this.passwordsMatchValidator] }
    );
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = this.resolveFormError();
      return;
    }

    this.loading = true;
    this.error = null;

    const { email, password, name } = this.form.getRawValue() as {
      email: string;
      password: string;
      name?: string;
    };

    this.authService
      .register({ email, password, displayName: name })
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response) this.navigateToReturnUrl();
        },
        error: (err: any) => {
          this.error = this.mapAuthError(err);
          this.loading = false;
        }
      });
  }

  onGoogle(): void {
    this.loading = true;
    this.error = null;

    this.authService.loginWithGoogle().subscribe({
      next: (response) => {
        this.loading = false;
        if (response) this.navigateToReturnUrl();
      },
      error: (err: any) => {
        this.error = this.mapAuthError(err);
        this.loading = false;
      }
    });
  }

  private navigateToReturnUrl(): void {
    const returnUrl =
      this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }

  private passwordsMatchValidator = (group: any) => {
    const password = group?.get?.('password')?.value;
    const confirm = group?.get?.('confirmPassword')?.value;
    return password && confirm && password !== confirm
      ? { passwordMismatch: true }
      : null;
  };

  private passwordPolicyValidator = (control: any) => {
    const value = String(control?.value || '');
    if (!value) return null;
    const hasUpper = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSymbol = /[^A-Za-z0-9]/.test(value);
    return hasUpper && hasNumber && hasSymbol ? null : { passwordPolicy: true };
  };

  private resolveFormError(): string {
    if (this.form.errors?.['passwordMismatch']) return 'Las contraseñas no coinciden.';
    const email = this.form.get('email');
    if (email?.errors?.['required']) return 'El email es obligatorio.';
    if (email?.errors?.['email']) return 'El email no tiene un formato válido.';
    const password = this.form.get('password');
    if (password?.errors?.['required']) return 'La contraseña es obligatoria.';
    if (password?.errors?.['minlength']) return 'La contraseña debe tener al menos 8 caracteres.';
    if (password?.errors?.['passwordPolicy'])
      return 'La contraseña debe incluir 1 mayúscula, 1 número y 1 símbolo.';
    return 'Revisa los campos del formulario.';
  }

  private mapAuthError(err: any): string {
    const code = String(err?.code || '');
    if (code === 'auth/email-already-in-use') return 'Este correo ya está registrado. Intenta iniciar sesión.';
    if (code === 'auth/invalid-email') return 'El correo electrónico no es válido.';
    if (code === 'auth/weak-password') return 'La contraseña es demasiado débil.';
    if (code === 'auth/popup-closed-by-user') return 'Cerraste la ventana de Google antes de completar el registro.';
    if (code === 'auth/network-request-failed') return 'Sin conexión. Verifica tu red e intenta de nuevo.';
    return 'No fue posible completar el registro. Inténtalo de nuevo.';
  }
}