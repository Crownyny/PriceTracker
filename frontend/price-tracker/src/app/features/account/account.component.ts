import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TokenService } from '../../core/services/token.service';
import { UserRoleService } from '../../core/services/user-role.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductsService } from '../products/services/products.service';
import { AlertService } from '../alerts/services/alert.service';
import { UserRole } from '../../shared/models/auth.model';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent implements OnInit {
  profile: ReturnType<TokenService['getUserProfile']> = null;
  currentRole: UserRole = 'registered';
  selectedRole: UserRole = 'registered';
  applying           = false;
  message            = '';
  error              = '';
  tokenPreview       = '';
  showUpgradeModal   = false;
  showDowngradeModal = false;

  constructor(
    private tokenService:    TokenService,
    private userRoleService: UserRoleService,
    private authService:     AuthService,
    private productsService: ProductsService,
    private alertService:    AlertService,
    private router:          Router,
    private cdr:             ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.profile      = this.tokenService.getUserProfile();
    this.currentRole  = this.tokenService.getUserRole();
    this.selectedRole = this.currentRole;

    const token = this.tokenService.getToken();
    this.tokenPreview = token ? token.slice(0, 20) + '…' : '(sin token)';
  }

  requestRoleChange(): void {
    if (this.selectedRole === this.currentRole || this.applying) return;
    if (this.selectedRole === 'premium') {
      this.showUpgradeModal = true;
    } else {
      this.showDowngradeModal = true;
    }
  }

  confirmRoleChange(): void {
    this.showUpgradeModal   = false;
    this.showDowngradeModal = false;
    this.applyRole();
  }

  cancelRoleChange(): void {
    this.showUpgradeModal   = false;
    this.showDowngradeModal = false;
    this.selectedRole = this.currentRole;
  }

  applyRole(): void {
    if (this.selectedRole === this.currentRole || this.applying) return;

    this.applying = true;
    this.message  = '';
    this.error    = '';

    this.userRoleService.updateUserRole(this.selectedRole).subscribe({
      next: (response) => {
        this.applying    = false;
        this.currentRole = response.role ?? this.selectedRole;
        this.tokenService.setUserRole(this.currentRole);

        if (this.currentRole === 'registered') {
          // Recortar wishlist: llama backend DELETE para los productos excedentes
          this.productsService.trimSavedToFreeLimit().subscribe();

          // Recortar alertas: desactivar las que excedan el límite de 3
          const FREE_ALERT_LIMIT = 3;
          this.alertService.getAlerts().subscribe(response => {
            const alerts = (response.alerts ?? [])
              .filter((a: any) => a.isActive !== false)
              .sort((a: any, b: any) =>
                new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
              );
            const toDeactivate = alerts.slice(FREE_ALERT_LIMIT);
            toDeactivate.forEach((a: any) => {
              this.alertService.updateAlertStatus(a.id, { isActive: false }).subscribe();
            });
          });

          this.message = 'Cambiaste al plan gratuito. Se conservaron tus 5 productos guardados más recientes y tus últimas 3 alertas.';
        } else {
          this.message = '¡Bienvenido a Premium! Ya puedes guardar productos y alertas sin límite.';
        }

        this.cdr.markForCheck();
        setTimeout(() => { this.message = ''; this.cdr.markForCheck(); }, 5000);
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