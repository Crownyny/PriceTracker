import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-required',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="auth-required">
      <h2>Sesion requerida</h2>
      <p>Necesitas un token valido para entrar al dashboard.</p>
      <p *ngIf="returnUrl">Ruta solicitada: {{ returnUrl }}</p>
      <a routerLink="/dashboard" class="btn">Intentar de nuevo</a>
    </section>
  `,
  styles: [
    `
      .auth-required {
        max-width: 720px;
        margin: 40px auto;
        padding: 24px;
        background: #fff;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
      }

      .btn {
        display: inline-block;
        margin-top: 16px;
        padding: 10px 14px;
        background: #1d4ed8;
        color: #fff;
        text-decoration: none;
        border-radius: 8px;
      }
    `
  ]
})
export class AuthRequiredComponent {
  returnUrl = '';

  constructor(private route: ActivatedRoute) {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
  }
}
