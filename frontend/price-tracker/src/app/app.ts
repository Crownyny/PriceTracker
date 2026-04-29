import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { ExtensionAuthBridgeService } from './core/services/extension-auth-bridge.service';
import { StompWebSocketService } from './core/services/stomp-websocket.service';

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
          <!-- Connection Status Indicator -->
          <span class="connection-badge" [class.connected]="isConnected" [class.disconnected]="!isConnected">
            {{ isConnected ? '🟢 Conectado' : '🔴 Desconectado' }}
          </span>
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
export class App implements OnInit {
  protected readonly title = 'price-traker';
  isConnected = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private extensionAuthBridge: ExtensionAuthBridgeService,
    private stompService: StompWebSocketService
  ) {
    console.log('🚀 Inicializando PriceTracker App');
  }

  ngOnInit(): void {
    // Conectar a STOMP WebSocket
    this.connectToWebSocket();
  }

  /**
   * Conecta el servicio STOMP y monitorea estado de conexión
   */
  private connectToWebSocket(): void {
    console.log('🔌 Conectando a WebSocket STOMP...');
    
    // Conectar
    this.stompService.connect();

    // Escuchar cambios de estado de conexión
    this.stompService.connected$.subscribe((isConnected: boolean) => {
      this.isConnected = isConnected;
      if (isConnected) {
        console.log('✅ WebSocket conectado - listo para búsquedas en tiempo real');
      } else {
        console.log('⚠️ WebSocket desconectado - usando REST como fallback');
      }
    });
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}

