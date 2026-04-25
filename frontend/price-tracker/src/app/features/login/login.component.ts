import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AuthResponse } from '../../shared/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="login-shell">
      <article class="login-card">
        <h2>Iniciar sesion</h2>
        <p>Accede con Firebase para usar tu dashboard de seguimiento de precios.</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <label>
            Email
            <input type="email" formControlName="email" placeholder="tu@email.com" />
          </label>

          <label>
            Password
            <input type="password" formControlName="password" placeholder="********" />
          </label>

          <button type="submit" [disabled]="form.invalid || loading">
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <p *ngIf="error" class="error">{{ error }}</p>

        <p class="back-link"><a routerLink="/dashboard">Ir al dashboard</a></p>
      </article>
    </section>
  `,
  styles: [
    `
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
        padding: 24px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      }

      h2 {
        margin: 0 0 8px;
      }

      p {
        margin: 0 0 16px;
        color: #4b5563;
      }

      form {
        display: grid;
        gap: 12px;
      }

      label {
        display: grid;
        gap: 6px;
        font-weight: 600;
        color: #1f2937;
      }

      input {
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
      }

      button {
        border: none;
        border-radius: 10px;
        padding: 10px 12px;
        background: #1d4ed8;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }

      button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .error {
        color: #b91c1c;
        margin-top: 12px;
      }

      .back-link {
        margin-top: 10px;
      }
    `
  ]
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

    this.error = null;
    this.loading = true;

    this.authService.login(this.form.getRawValue() as { email: string; password: string }).pipe(
      catchError((err) => {
        this.error = 'No fue posible iniciar sesion con Firebase. Verifica email y contraseña.';
        console.error('Login error:', err);
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((response) => {
      if (!response) {
        return;
      }

      this.navigateToReturnUrl();
    });
  }

  private navigateToReturnUrl(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }
}
