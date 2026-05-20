import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { ExtensionAuthBridgeService } from './core/services/extension-auth-bridge.service';
import { StompWebSocketService } from './core/services/stomp-websocket.service';
import { Subject, skip, takeUntil } from 'rxjs';
import { TokenService } from './core/services/token.service';
import { UserRoleService } from './core/services/user-role.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container">
      <nav class="navbar">
        <a routerLink="/dashboard" class="navbar-brand">
          <h1>💰 PriceTracker</h1>
        </a>

        <div class="navbar-actions">
          <span *ngIf="!isAuthenticated" class="connection-badge" [class.connected]="isConnected" [class.disconnected]="!isConnected">
            {{ isConnected ? '🟢 Conectado' : '🔴 Desconectado' }}
          </span>

          <ul class="nav-links desktop-links">
            <li><a routerLink="/dashboard" routerLinkActive="active">Dashboard</a></li>
            <li><a routerLink="/price-history" routerLinkActive="active">Historial</a></li>
            <li><a routerLink="/alerts" routerLinkActive="active">Alertas</a></li>
          </ul>

          <button *ngIf="!isAuthenticated" type="button" class="auth-link" routerLink="/login">
            Iniciar sesión
          </button>

          <div *ngIf="isAuthenticated" class="account-menu-wrap">
            <button type="button" class="account-button" (click)="toggleAccountMenu()">
              <span class="account-avatar">{{ userInitial }}</span>
              <span class="account-label">Mi cuenta</span>
            </button>

            <div *ngIf="showAccountMenu" class="account-menu">
              <div class="account-menu-header">
                <div class="account-menu-name">{{ userDisplayName }}</div>
                <div class="account-menu-email">{{ userEmail }}</div>
              </div>

              <a routerLink="/account" (click)="closeAccountMenu()" class="account-menu-item">Perfil y ajustes</a>
              <a routerLink="/search" (click)="closeAccountMenu()" class="account-menu-item">Buscar productos</a>
              <a routerLink="/saved" (click)="closeAccountMenu()" class="account-menu-item">Mis guardados</a>
              <a routerLink="/email-notifications" (click)="closeAccountMenu()" class="account-menu-item">Notificaciones email</a>
              <a routerLink="/price-history" (click)="closeAccountMenu()" class="account-menu-item">Historial de precios</a>
              <a routerLink="/documentation" (click)="closeAccountMenu()" class="account-menu-item">Documentación</a>

              <button type="button" class="account-logout" (click)="logout()">Cerrar sesión</button>
            </div>
          </div>
        </div>
      </nav>

      <!-- Main Content -->
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  isConnected = false;
  isAuthenticated = false;
  private roleFetchedForSession = false;
  showAccountMenu = false;
  userDisplayName = 'Mi cuenta';
  userEmail = '';
  userInitial = 'M';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private extensionAuthBridge: ExtensionAuthBridgeService,
    private stompService: StompWebSocketService,
    private tokenService:    TokenService,
    private userRoleService: UserRoleService
  ) {}

  ngOnInit(): void {
    this.syncAuthState();

    // Conectar a STOMP WebSocket
    this.connectToWebSocket();

    this.tokenService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isAuthenticated) => {
        this.isAuthenticated = isAuthenticated;
        this.refreshUserInfo();
        if (!isAuthenticated) {
          this.showAccountMenu = false;
          this.roleFetchedForSession = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private connectToWebSocket(): void {
    this.stompService.connect();
    this.stompService.connected$
      .pipe(skip(1), takeUntil(this.destroy$))
      .subscribe((isConnected: boolean) => {
        this.isConnected = isConnected;
      });
  }

  private syncAuthState(): void {
    this.isAuthenticated = this.tokenService.hasToken() && !!this.tokenService.getUserProfile();
    this.refreshUserInfo();
    if (this.isAuthenticated && !this.roleFetchedForSession) {
      this.roleFetchedForSession = true;
      this.userRoleService.fetchAndSyncRole()
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }
  }

  private refreshUserInfo(): void {
    const profile = this.tokenService.getUserProfile();
    const email = profile?.email || '';
    const name = profile?.name || email || 'Mi cuenta';

    this.userEmail = email;
    this.userDisplayName = name;
    this.userInitial = (name || 'M').trim().charAt(0).toUpperCase();
  }

  toggleAccountMenu(): void {
    this.showAccountMenu = !this.showAccountMenu;
  }

  closeAccountMenu(): void {
    this.showAccountMenu = false;
  }

  async logout(): Promise<void> {
    this.closeAccountMenu();
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}