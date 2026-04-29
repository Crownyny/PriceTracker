import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h2>Crear Cuenta</h2>
        
        <form (ngSubmit)="register()">
          <div class="form-group">
            <label for="name">Nombre Completo</label>
            <input
              id="name"
              type="text"
              [(ngModel)]="formData.name"
              name="name"
              placeholder="Tu nombre"
              class="input-field"
              required
            />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="formData.email"
              name="email"
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
              [(ngModel)]="formData.password"
              name="password"
              placeholder="••••••••"
              class="input-field"
              required
            />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmar Contraseña</label>
            <input
              id="confirmPassword"
              type="password"
              [(ngModel)]="formData.confirmPassword"
              name="confirmPassword"
              placeholder="••••••••"
              class="input-field"
              required
            />
          </div>

          <button type="submit" class="submit-btn">
            Registrarse
          </button>
        </form>

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
  formData = {
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  };
  error = '';

  register() {
    // Aquí iría la lógica de registro
    if (this.formData.password !== this.formData.confirmPassword) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }
    console.log('Registrando usuario:', this.formData.email);
  }
}
