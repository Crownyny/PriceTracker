import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { ExtensionAuthBridgeService } from './core/services/extension-auth-bridge.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container">
      <!-- Navigation -->
      <nav class="navbar">
        <div class="navbar-brand">
          <h1>💰 PriceTracker</h1>
        </div>
        <ul class="nav-links">
          <li><a routerLink="/dashboard" routerLinkActive="active">Dashboard</a></li>
          <li><a routerLink="/price-history" routerLinkActive="active">Historial</a></li>
          <li><a routerLink="/alerts" routerLinkActive="active">Alertas</a></li>
          <li><a routerLink="/login" routerLinkActive="active">Iniciar sesion</a></li>
          <li><button type="button" class="logout-btn" (click)="logout()">Cerrar sesion</button></li>
        </ul>
      </nav>

      <!-- Main Content -->
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styleUrl: './app.css'
})
export class App {
  protected readonly title = 'price-traker';

  constructor(
    private authService: AuthService,
    private router: Router,
    private extensionAuthBridge: ExtensionAuthBridgeService
  ) {}

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}

