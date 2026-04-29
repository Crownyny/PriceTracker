import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="forgot-password-container">
      <div class="forgot-password-card">
        <h2>Recuperar Contraseña</h2>
        
        <div *ngIf="!submitted" class="form-section">
          <p class="description">
            Ingresa tu email y te enviaremos instrucciones para recuperar tu contraseña.
          </p>

          <form (ngSubmit)="submitEmail()">
            <div class="form-group">
              <label for="email">Email</label>
              <input
                id="email"
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="tu@email.com"
                class="input-field"
                required
              />
            </div>

            <button type="submit" class="submit-btn">
              Enviar Instrucciones
            </button>
          </form>

          <div *ngIf="error" class="error-message">
            {{ error }}
          </div>

          <p class="back-link">
            <a routerLink="/login">← Volver a Login</a>
          </p>
        </div>

        <div *ngIf="submitted" class="success-section">
          <h3>✓ Email Enviado</h3>
          <p>
            Hemos enviado instrucciones de recuperación de contraseña a <strong>{{ email }}</strong>
          </p>
          <p>Por favor, revisa tu bandeja de entrada.</p>
          
          <a routerLink="/login" class="back-btn">
            Volver al Login
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .forgot-password-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .forgot-password-card {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
    }
    .forgot-password-card h2 {
      text-align: center;
      margin-bottom: 20px;
      color: #333;
    }
    .description {
      color: #666;
      margin-bottom: 20px;
      line-height: 1.5;
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
    }
    .submit-btn:hover {
      opacity: 0.9;
    }
    .error-message {
      background: #f8d7da;
      color: #721c24;
      padding: 12px;
      border-radius: 4px;
      margin-top: 20px;
      border: 1px solid #f5c6cb;
    }
    .back-link {
      text-align: center;
      margin-top: 20px;
    }
    .back-link a {
      color: #667eea;
      text-decoration: none;
    }
    .back-link a:hover {
      text-decoration: underline;
    }
    .success-section {
      text-align: center;
    }
    .success-section h3 {
      color: #28a745;
      margin-bottom: 15px;
    }
    .success-section p {
      color: #666;
      margin-bottom: 10px;
      line-height: 1.5;
    }
    .back-btn {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 4px;
    }
    .back-btn:hover {
      opacity: 0.9;
    }
  `]
})
export class ForgotPasswordComponent {
  email = '';
  submitted = false;
  error = '';

  submitEmail() {
    // Aquí iría la lógica para enviar email de recuperación
    if (!this.email) {
      this.error = 'Por favor ingresa un email válido';
      return;
    }
    this.submitted = true;
  }
}
