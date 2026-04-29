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
    <div class="register-container">
      <div class="register-card">
        <h2>Crear Cuenta</h2>
        
        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="form-group">
            <label for="name">Nombre Completo</label>
            <input
              id="name"
              type="text"
              formControlName="name"
              placeholder="Tu nombre"
              class="input-field"
            />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="tu@email.com"
              class="input-field"
              required
            />
          </div>

          <div class="form-group">
            <label for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="••••••••"
              class="input-field"
              required
            />
            <small class="hint">Mínimo 8 caracteres, 1 mayúscula, 1 número y 1 símbolo.</small>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmar Contraseña</label>
            <input
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              placeholder="••••••••"
              class="input-field"
              required
            />
          </div>

          <button type="submit" class="submit-btn" [disabled]="form.invalid || loading">
            {{ loading ? 'Registrando...' : 'Registrarse' }}
          </button>
        </form>

        <button type="button" class="google-btn" (click)="onGoogle()" [disabled]="loading">
          Continuar con Google
        </button>

        <p class="login-link">
          ¿Ya tienes cuenta? 
          <a routerLink="/login">Inicia sesión</a>
        </p>

        <div *ngIf="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .register-card {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
    }
    .register-card h2 {
      text-align: center;
      margin-bottom: 30px;
      color: #333;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #333;
    }
    .input-field {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
      box-sizing: border-box;
    }
    .input-field:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .submit-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
    }
    .submit-btn:hover {
      opacity: 0.9;
    }
    .submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .hint {
      display: block;
      margin-top: 8px;
      color: #6b7280;
      font-size: 12px;
    }
    .google-btn {
      width: 100%;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      background: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 10px;
    }
    .google-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .login-link {
      text-align: center;
      margin-top: 20px;
      color: #666;
    }
    .login-link a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }
    .login-link a:hover {
      text-decoration: underline;
    }
    .error-message {
      background: #f8d7da;
      color: #721c24;
      padding: 12px;
      border-radius: 4px;
      margin-top: 20px;
      border: 1px solid #f5c6cb;
    }
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
    this.form = this.formBuilder.group({
      name: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), this.passwordPolicyValidator]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: [this.passwordsMatchValidator] });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = this.resolveFormError();
      return;
    }

    this.loading = true;
    this.error = null;

    const { email, password, name } = this.form.getRawValue() as { email: string; password: string; name?: string };
    this.authService.register({ email, password, displayName: name }).pipe(
      catchError((err) => {
        this.error = this.mapAuthError(err);
        console.error('Register error:', err);
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((response) => {
      if (!response) return;
      this.navigateToReturnUrl();
    });
  }

  onGoogle(): void {
    this.loading = true;
    this.error = null;
    this.authService.loginWithGoogle().pipe(
      catchError((err) => {
        this.error = this.mapAuthError(err);
        console.error('Google login error:', err);
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((response) => {
      if (!response) return;
      this.navigateToReturnUrl();
    });
  }

  private navigateToReturnUrl(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }

  private passwordsMatchValidator = (group: any) => {
    const password = group?.get?.('password')?.value;
    const confirm = group?.get?.('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
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
    if (this.form.errors?.['passwordMismatch']) return 'Las contraseñas no coinciden';
    const email = this.form.get('email');
    if (email?.errors?.['required']) return 'El email es obligatorio';
    if (email?.errors?.['email']) return 'El email no tiene un formato válido';
    const password = this.form.get('password');
    if (password?.errors?.['required']) return 'La contraseña es obligatoria';
    if (password?.errors?.['minlength']) return 'La contraseña debe tener al menos 8 caracteres';
    if (password?.errors?.['passwordPolicy']) return 'La contraseña debe incluir 1 mayúscula, 1 número y 1 símbolo';
    return 'Revisa los campos del formulario';
  }

  private mapAuthError(err: any): string {
    const code = err?.code as string | undefined;
    if (code === 'auth/email-already-in-use') return 'Este correo electrónico ya está registrado';
    if (code === 'auth/invalid-email') return 'El correo electrónico no es válido';
    if (code === 'auth/weak-password') return 'La contraseña es demasiado débil';
    if (code === 'auth/popup-closed-by-user') return 'Cerraste la ventana de Google antes de completar el registro';
    return 'No fue posible completar el registro. Inténtalo de nuevo.';
  }
}
