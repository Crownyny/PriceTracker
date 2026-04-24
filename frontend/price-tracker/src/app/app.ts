import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

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
}

