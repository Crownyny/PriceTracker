import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TokenService } from '../../core/services/token.service';
import { UserRoleService } from '../../core/services/user-role.service';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../shared/models/auth.model';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ac-shell">
      <div class="ac-card" *ngIf="profile">

        <!-- Header -->
        <div class="ac-header">
          <div class="ac-avatar">
            <img *ngIf="profile.avatar" [src]="profile.avatar" [alt]="profile.name" />
            <span *ngIf="!profile.avatar">{{ initials() }}</span>
          </div>
          <div>
            <h2 class="ac-name">{{ profile.name || profile.email }}</h2>
            <p class="ac-email">{{ profile.email }}</p>
          </div>
        </div>

        <!-- Role badge -->
        <div class="ac-role-badge" [class.ac-role-premium]="currentRole === 'premium'">
          {{ currentRole === 'premium' ? '⭐ Premium' : '🔓 Freemium' }}
        </div>

        <hr class="ac-divider" />

        <!-- Role change section -->
        <div class="ac-section">
          <h3 class="ac-section-title">Cambiar rol</h3>
          <p class="ac-hint">
            Usa esto para probar funcionalidades. El cambio se aplica en el backend.
          </p>

          <div class="ac-role-grid">
            <button class="ac-role-opt"
                    [class.ac-role-opt-active]="selectedRole === 'registered'"
                    (click)="selectedRole = 'registered'">
              <span class="ac-role-opt-icon">🔓</span>
              <span class="ac-role-opt-label">Freemium</span>
              <span class="ac-role-opt-desc">Hasta 3 alertas</span>
            </button>
            <button class="ac-role-opt"
                    [class.ac-role-opt-active]="selectedRole === 'premium'"
                    (click)="selectedRole = 'premium'">
              <span class="ac-role-opt-icon">⭐</span>
              <span class="ac-role-opt-label">Premium</span>
              <span class="ac-role-opt-desc">Alertas ilimitadas</span>
            </button>
          </div>

          <button class="ac-btn-primary"
                  [disabled]="applying || selectedRole === currentRole"
                  (click)="applyRole()">
            {{ applying ? 'Aplicando...' : 'Aplicar rol' }}
          </button>

          <div *ngIf="message" class="ac-msg ac-msg-ok">✓ {{ message }}</div>
          <div *ngIf="error"   class="ac-msg ac-msg-err">{{ error }}</div>
        </div>

        <hr class="ac-divider" />

        <!-- Debug info -->
        <div class="ac-section ac-debug">
          <h3 class="ac-section-title">Debug info <span class="ac-debug-badge">DEV</span></h3>
          <div class="ac-debug-row">
            <span>User ID</span><code>{{ profile.id }}</code>
          </div>
          <div class="ac-debug-row">
            <span>Rol en localStorage</span>
            <code [style.color]="currentRole === 'premium' ? '#16a34a' : '#6b7280'">
              {{ currentRole }}
            </code>
          </div>
          <div class="ac-debug-row">
            <span>Token (primeros 20 chars)</span>
            <code>{{ tokenPreview }}</code>
          </div>
        </div>

        <hr class="ac-divider" />

        <!-- Logout -->
        <button class="ac-btn-logout" (click)="logout()">Cerrar sesión</button>
      </div>
    </div>
  `,
  styles: [`
    .ac-shell {
      min-height: 100vh; background: #f8f9fc;
      display: flex; align-items: flex-start; justify-content: center;
      padding: 40px 16px; font-family: 'DM Sans', system-ui, sans-serif;
    }
    .ac-card {
      background: #fff; border-radius: 16px; padding: 32px 28px;
      width: min(480px, 100%); box-shadow: 0 2px 16px rgba(0,0,0,.07);
      display: flex; flex-direction: column; gap: 0;
    }
    .ac-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .ac-avatar {
      width: 56px; height: 56px; border-radius: 50%;
      background: #4f46e5; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem; font-weight: 700; overflow: hidden; flex-shrink: 0;
    }
    .ac-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .ac-name  { font-size: 1.125rem; font-weight: 700; color: #111827; margin: 0 0 2px; }
    .ac-email { font-size: .875rem; color: #6b7280; margin: 0; }

    .ac-role-badge {
      display: inline-flex; align-items: center;
      background: #f3f4f6; color: #6b7280;
      font-size: .8125rem; font-weight: 700;
      padding: 5px 14px; border-radius: 99px;
      margin-bottom: 20px; align-self: flex-start;
    }
    .ac-role-premium { background: #fef9c3; color: #854d0e; }

    .ac-divider { border: none; border-top: 1px solid #f3f4f6; margin: 20px 0; }

    .ac-section { display: flex; flex-direction: column; gap: 12px; }
    .ac-section-title { font-size: .9375rem; font-weight: 700; color: #111827; margin: 0; }
    .ac-hint { font-size: .8125rem; color: #6b7280; margin: 0; }

    .ac-role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .ac-role-opt {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 14px 10px; border: 1.5px solid #e5e7eb; border-radius: 12px;
      background: #fff; cursor: pointer; transition: border-color .13s, background .13s;
    }
    .ac-role-opt:hover { border-color: #c7d2fe; background: #fafbff; }
    .ac-role-opt-active { border-color: #4f46e5 !important; background: #eef2ff !important; }
    .ac-role-opt-icon  { font-size: 1.5rem; }
    .ac-role-opt-label { font-size: .9375rem; font-weight: 700; color: #111827; }
    .ac-role-opt-desc  { font-size: .75rem; color: #6b7280; }

    .ac-btn-primary {
      background: #4f46e5; color: #fff; border: none; border-radius: 10px;
      padding: 11px 16px; font-size: .9375rem; font-weight: 600;
      cursor: pointer; transition: background .15s;
    }
    .ac-btn-primary:hover:not(:disabled) { background: #4338ca; }
    .ac-btn-primary:disabled { opacity: .55; cursor: not-allowed; }

    .ac-msg { padding: 10px 14px; border-radius: 8px; font-size: .875rem; font-weight: 500; }
    .ac-msg-ok  { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .ac-msg-err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

    .ac-debug { background: #f9fafb; border-radius: 10px; padding: 14px; }
    .ac-debug-badge {
      background: #e5e7eb; color: #6b7280;
      font-size: .65rem; padding: 2px 6px; border-radius: 4px;
      vertical-align: middle; margin-left: 6px;
    }
    .ac-debug-row {
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px; font-size: .8125rem; color: #6b7280;
    }
    .ac-debug-row code {
      font-family: monospace; font-size: .8rem; color: #374151;
      background: #e5e7eb; padding: 2px 6px; border-radius: 4px;
      max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .ac-btn-logout {
      background: transparent; border: 1.5px solid #fca5a5; color: #dc2626;
      border-radius: 10px; padding: 10px 16px; font-size: .9375rem; font-weight: 600;
      cursor: pointer; transition: background .13s;
    }
    .ac-btn-logout:hover { background: #fef2f2; }
  `]
})
export class AccountComponent implements OnInit {
  profile: ReturnType<TokenService['getUserProfile']> = null;
  currentRole: UserRole = 'registered';
  selectedRole: UserRole = 'registered';
  applying = false;
  message = '';
  error = '';
  tokenPreview = '';

  constructor(
    private tokenService:    TokenService,
    private userRoleService: UserRoleService,
    private authService:     AuthService,
    private router:          Router,
    private cdr:             ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.profile     = this.tokenService.getUserProfile();
    this.currentRole = this.tokenService.getUserRole();
    this.selectedRole = this.currentRole;

    const token = this.tokenService.getToken();
    this.tokenPreview = token ? token.slice(0, 20) + '…' : '(sin token)';

    // ── Log en consola ──────────────────────────────────────────────────────
    console.group('%c[PriceTracker] Sesión activa', 'color:#4f46e5;font-weight:bold');
    console.log('Usuario:', this.profile?.email ?? '—');
    console.log('ID:',      this.profile?.id     ?? '—');
    console.log('%cRol actual: ' + this.currentRole.toUpperCase(),
      this.currentRole === 'premium'
        ? 'color:#16a34a;font-weight:bold;font-size:14px'
        : 'color:#6b7280;font-size:14px'
    );
    console.log('Es premium:', this.userRoleService.canUsePremiumFeatures());
    console.log('Token (primeros 40):', token?.slice(0, 40) ?? '(ninguno)');
    console.groupEnd();
  }

  applyRole(): void {
    if (this.selectedRole === this.currentRole || this.applying) return;

    this.applying = true;
    this.message  = '';
    this.error    = '';

    // Llamada real al backend: PUT /api/v1/user/role
    this.userRoleService.updateUserRole(this.selectedRole).subscribe({
      next: (response) => {
        this.applying    = false;
        this.currentRole = response.role ?? this.selectedRole;
        this.tokenService.setUserRole(this.currentRole);
        this.message = `Rol actualizado a: ${this.currentRole}`;

        console.log(
          `%c[PriceTracker] Rol cambiado a ${this.currentRole.toUpperCase()}`,
          this.currentRole === 'premium'
            ? 'color:#16a34a;font-weight:bold'
            : 'color:#6b7280;font-weight:bold'
        );

        setTimeout(() => this.message = '', 3500);
      },
      error: (err) => {
        this.applying = false;

        if (err?.error?.code === 'USER_ROLE_CONFLICT' ||
            String(err?.error?.message ?? '').toLowerCase().includes('ya tiene') ||
            String(err?.error?.message ?? '').toLowerCase().includes('already has')) {
          this.tokenService.setUserRole(this.selectedRole);
          this.currentRole = this.selectedRole;
          this.message = `Rol sincronizado a: ${this.currentRole}`;
          this.load();
          this.cdr.markForCheck();
          setTimeout(() => { this.message = ''; this.cdr.markForCheck(); }, 3500);
          return;
        }

        this.error = err?.error?.message ?? 'Error al cambiar el rol. Intenta de nuevo.';
        this.cdr.markForCheck();
      }
    });
  }

  initials(): string {
    const name = this.profile?.name ?? this.profile?.email ?? '?';
    return name.slice(0, 2).toUpperCase();
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}