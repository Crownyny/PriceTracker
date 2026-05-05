import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AuthResponse } from '../../shared/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="login-shell">
      <article class="login-card">
        <h2>Iniciar sesión</h2>
        <p>Accede para usar tu dashboard de seguimiento de precios.</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <label>
            Email
            <input type="email" formControlName="email" placeholder="tu@email.com" autocomplete="email" />
          </label>

          <label>
            Contraseña
            <input type="password" formControlName="password" placeholder="••••••••" autocomplete="current-password" />
          </label>

          <!-- Error visible siempre que exista, independiente del estado loading -->
          <p *ngIf="error" class="error">{{ error }}</p>

          <button type="submit" [disabled]="form.invalid || loading">
            {{ loading ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>

        <button type="button" class="google" (click)="onGoogle()" [disabled]="loading">
          Continuar con Google
        </button>

        <p class="links">
          <a routerLink="/forgot-password">¿Olvidaste tu contraseña?</a>
        </p>

        <p class="links">
          ¿No tienes cuenta?
          <a routerLink="/register">Regístrate</a>
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
      gap: 6px;
      font-weight: 600;
      color: #1f2937;
      font-size: 0.875rem;
    }

    input {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      transition: border-color 0.15s;
      outline: none;
    }
    input:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,.1); }

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

    /* Error mostrado ENCIMA del botón para que sea inmediatamente visible */
    .error {
      color: #b91c1c;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 0.875rem;
      margin: 0;
    }

    .links {
      margin-top: 12px;
      font-size: 0.875rem;
      color: #6b7280;
    }
    .links a { color: #1d4ed8; font-weight: 500; text-decoration: none; }
    .links a:hover { text-decoration: underline; }
  `]
})
export class LoginComponent {
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
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Limpiar error ANTES de deshabilitar el botón para que el usuario
    // vea el estado limpio mientras espera la nueva respuesta.
    this.error = null;
    this.loading = true;

    this.authService
      .login(this.form.getRawValue() as { email: string; password: string })
      .subscribe({
        next: (response: AuthResponse) => {
          this.loading = false;
          if (response) {
            this.navigateToReturnUrl();
          }
        },
        error: (err: any) => {
          // El error se setea ANTES de quitar el loading para que
          // aparezca en pantalla en el mismo ciclo de detección de cambios.
          this.error = this.mapFirebaseError(err);
          this.loading = false;
        }
      });
  }

  onGoogle(): void {
    this.error = null;
    this.loading = true;

    this.authService.loginWithGoogle().subscribe({
      next: (response: AuthResponse) => {
        this.loading = false;
        if (response) this.navigateToReturnUrl();
      },
      error: (err: any) => {
        this.error =
          err?.code === 'auth/popup-closed-by-user'
            ? 'Cerraste la ventana de Google antes de completar el inicio de sesión.'
            : 'No fue posible iniciar sesión con Google.';
        this.loading = false;
      }
    });
  }

  private navigateToReturnUrl(): void {
    const returnUrl =
      this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }

  private mapFirebaseError(err: any): string {
    const code = String(err?.code || '');
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Email o contraseña incorrectos.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Sin conexión. Verifica tu red e intenta de nuevo.';
    }
    return 'No fue posible iniciar sesión. Verifica tus credenciales.';
  }
}