import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductsService } from '../products/services/products.service';
import { AlertService } from '../alerts/services/alert.service';
import { TokenService } from '../../core/services/token.service';
import { Product } from '../../shared/models/product.model';
import { Alert } from '../../shared/models/alert.model';
import { catchError, finalize, of, timeout } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-container">
      <!-- Hero Section -->
      <div class="hero-section">
        <h2>Bienvenido a PriceTracker</h2>
        <p>Compara precios en tiempo real y ahorra en cada compra</p>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <h3>Ahorro Total</h3>
            <p>$ {{ totalSavings | number }}</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-content">
            <h3>Productos Guardados</h3>
            <p>{{ savedProducts.length }}</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">🔔</div>
          <div class="stat-content">
            <h3>Alertas Activas</h3>
            <p>{{ activeAlerts.length }}</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <h3>Comparaciones</h3>
            <p>{{ totalComparisons }}</p>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h3>Acciones Rápidas</h3>
        <div class="actions-grid">
          <a routerLink="/price-history" class="action-btn">
            <span>📈</span>
            <span>Ver Historial de Precios</span>
          </a>
          <a routerLink="/alerts" class="action-btn">
            <span>🔔</span>
            <span>Gestionar Alertas</span>
          </a>
          <a routerLink="/products" class="action-btn">
            <span>💻</span>
            <span>Mis Productos</span>
          </a>
        </div>
      </div>

      <!-- Recent Products -->
      <div class="recent-section" *ngIf="savedProducts.length > 0">
        <h3>Productos Recientes</h3>
        <div class="products-list">
          <div *ngFor="let product of savedProducts.slice(0, 5)" class="product-item">
            <img *ngIf="product.image" [src]="product.image" alt="{{ product.name }}" />
            <div class="product-info">
              <h4>{{ product.name }}</h4>
              <p>{{ product.currentPrice | currency }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading">
        Cargando información...
      </div>

      <!-- Error State -->
      <div *ngIf="error" class="error">
        {{ error }}
      </div>
    </div>
  `,
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  savedProducts: Product[] = [];
  activeAlerts: Alert[] = [];
  totalSavings: number = 0;
  totalComparisons: number = 0;
  loading: boolean = true;
  error: string | null = null;

  constructor(
    private productsService: ProductsService,
    private alertService: AlertService,
    private tokenService: TokenService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    try {
      const userProfile = this.tokenService.getUserProfile();
      
      if (!userProfile?.id) {
        this.error = 'Usuario no autenticado';
        this.loading = false;
        return;
      }

      // Cargar productos guardados
      this.productsService.getSavedProducts(userProfile.id, 0, 5).pipe(
        timeout(10000),
        catchError((err) => {
          console.error('Error cargando productos:', err);
          this.error = 'No se pudo cargar productos (timeout o backend no disponible)';
          return of({ products: [] } as any);
        }),
        finalize(() => {
          this.loading = false;
        })
      ).subscribe({
        next: (response) => {
          this.savedProducts = response.products ?? [];
          this.calculateStats();
        }
      });

      // Cargar alertas activas
      this.alertService.getAlerts(userProfile.id).pipe(
        timeout(10000),
        catchError((err) => {
          console.error('Error cargando alertas:', err);
          return of({ alerts: [] } as any);
        })
      ).subscribe({
        next: (response) => {
          this.activeAlerts = (response.alerts ?? []).filter((a: Alert) => a.isActive);
        }
      });
    } catch (err) {
      this.error = 'Error al cargar dashboard';
      this.loading = false;
    }
  }

  private calculateStats(): void {
    // Calcula estadísticas básicas
    this.totalComparisons = this.savedProducts.length;
    this.totalSavings = this.savedProducts.reduce((sum, product) => {
      // Esto sería más complejo con datos reales
      return sum + 0;
    }, 0);
  }
}
