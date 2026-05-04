import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TokenService } from '../../core/services/token.service';
import { UserRole } from '../../shared/models/auth.model';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="account-container">
      <h2>Mi Cuenta</h2>

      <div *ngIf="userProfile" class="account-form">
        <div class="form-group">
          <label>Rol temporal</label>
          <select
            [(ngModel)]="selectedRole"
            class="input-field"
          >
            <option value="registered">Freemium / Registered</option>
            <option value="premium">Premium</option>
          </select>
          <small class="helper-text">
            Este cambio es temporal y solo afecta esta sesión/navegador.
          </small>
        </div>

        <div class="form-group">
          <label>Email</label>
          <input 
            type="email" 
            [(ngModel)]="userProfile.email"
            readonly
            class="input-field"
          />
        </div>

        <div class="form-group">
          <label>Nombre</label>
          <input 
            type="text" 
            [(ngModel)]="userProfile.name"
            class="input-field"
            placeholder="Tu nombre completo"
          />
        </div>

        <div class="form-group">
          <label>Avatar URL</label>
          <input 
            type="text" 
            [(ngModel)]="userProfile.avatar"
            class="input-field"
            placeholder="URL de tu foto de perfil"
          />
        </div>

        <div class="form-actions">
          <button (click)="applyTemporaryRole()" class="role-btn">
            Aplicar rol temporal
          </button>
          <button (click)="updateProfile()" class="save-btn">
            Guardar Cambios
          </button>
          <button (click)="logout()" class="logout-btn">
            Cerrar Sesión
          </button>
        </div>
      </div>

      <div *ngIf="message" class="success-message">
        {{ message }}
      </div>

      <div *ngIf="error" class="error-message">
        {{ error }}
      </div>
    </div>
  `,
  styles: [`
    .account-container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }
    .account-form {
      margin-top: 30px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }
    .input-field {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
    }
    .input-field:readonly {
      background: #f5f5f5;
      cursor: not-allowed;
    }
    .form-actions {
      display: flex;
      gap: 10px;
      margin-top: 30px;
    }
    button {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    .save-btn {
      background: #28a745;
      color: white;
      flex: 1;
    }
    .role-btn {
      background: #0d6efd;
      color: white;
      flex: 1;
    }
    .logout-btn {
      background: #dc3545;
      color: white;
      flex: 1;
    }
    .helper-text {
      display: block;
      margin-top: 6px;
      color: #6b7280;
      font-size: 12px;
    }
    .success-message, .error-message {
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
    }
    .success-message {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .error-message {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
  `]
})
export class AccountComponent implements OnInit {
  userProfile: UserProfile | null = null;
  message = '';
  error = '';
  selectedRole: UserRole = 'registered';

  constructor(private tokenService: TokenService) {}

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile() {
    const storedProfile = this.tokenService.getUserProfile();
    this.selectedRole = this.tokenService.getUserRole();

    this.userProfile = storedProfile
      ? {
          id: storedProfile.id,
          email: storedProfile.email,
          name: storedProfile.name,
          avatar: storedProfile.avatar
        }
      : {
          id: '123',
          email: 'usuario@example.com',
          name: 'Juan Pérez',
          avatar: ''
        };
  }

  applyTemporaryRole() {
    this.tokenService.setUserRole(this.selectedRole);
    this.message = `Rol temporal aplicado: ${this.selectedRole}`;
    setTimeout(() => this.message = '', 3000);
  }

  updateProfile() {
    if (this.userProfile) {
      // Aquí iría la lógica para actualizar el perfil
      this.message = 'Perfil actualizado correctamente';
      setTimeout(() => this.message = '', 3000);
    }
  }

  logout() {
    this.tokenService.logout();
    // Aquí iría la redirección a login
    window.location.href = '/login';
  }
}
