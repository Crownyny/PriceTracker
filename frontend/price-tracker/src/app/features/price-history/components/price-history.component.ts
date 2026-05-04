import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PriceHistoryService } from '../services/price-history.service';
import { HttpConfigService } from '../../../core/services/http-config.service';
import { ProductsService } from '../../products/services/products.service';
import { TokenService } from '../../../core/services/token.service';
import { AlertService } from '../../alerts/services/alert.service';
import { PriceHistoryResponse, PriceHistoryRange } from '../../../shared/models/price-history.model';
import { Product } from '../../../shared/models/product.model';
import { Alert } from '../../../shared/models/alert.model';

@Component({
  selector: 'app-price-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="price-history-container">
      <header>
        <h2>Historial de Precios</h2>
        <p>Analiza tendencias de los productos con alertas activadas</p>
      </header>

      <!-- Controls -->
      <div class="controls">
        <!-- Selector de productos con alertas -->
        <div class="alerts-products-section">
          <label>Productos con Alertas:</label>
          <select [(ngModel)]="selectedProductId" (change)="onProductChange()" class="product-select">
            <option value="">-- Selecciona un producto --</option>
            <option *ngFor="let p of productsWithAlerts" [value]="p.id">{{ p.productName }}</option>
          </select>
        </div>

        <!-- Link a crear alertas -->
        <div class="create-alert-section">
          <button (click)="goToAlerts()" class="create-alert-btn">+ Crear Alerta</button>
        </div>

        <div class="filter-section">
          <label>Rango:</label>
          <select [(ngModel)]="selectedRange" (change)="onRangeChange()">
            <option value="W3">3 Semanas</option>
            <option value="W12">3 Meses</option>
            <option value="ALL">Todo el Historial</option>
          </select>
        </div>
      </div>

      <!-- Price History Chart -->
      <div class="chart-section" *ngIf="priceData">
        <div class="price-stats">
          <div class="stat">
            <span class="label">Precio Actual</span>
            <span class="value">{{ priceData.history[0]?.price | currency }}</span>
          </div>
          <div class="stat">
            <span class="label">Precio Mínimo</span>
            <span class="value">{{ getMinPrice() | currency }}</span>
          </div>
          <div class="stat">
            <span class="label">Precio Máximo</span>
            <span class="value">{{ getMaxPrice() | currency }}</span>
          </div>
          <div class="stat">
            <span class="label">Precio Promedio</span>
            <span class="value">{{ getAveragePrice() | currency }}</span>
          </div>
        </div>

        <!-- Simple Chart (usando tabla por ahora) -->
        <div class="price-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Precio</th>
                <th>Tienda</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let point of priceData.history.slice(0, 20)">
                <td>{{ point.updatedAt | date: 'short' }}</td>
                <td>{{ point.price | currency }}</td>
                <td>{{ point.sourceName || point.source || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State - Sin alertas -->
      <div *ngIf="!loading && productsWithAlerts.length === 0" class="empty-state no-alerts">
        <h3>No tienes alertas de precios activadas</h3>
        <p>Crea alertas para monitorear productos y ver su historial de precios</p>
        <button (click)="goToAlerts()" class="action-btn">Crear tu primera alerta</button>
      </div>

      <!-- Empty State - Sin producto seleccionado -->
      <div *ngIf="!priceData && !loading && productsWithAlerts.length > 0" class="empty-state">
        <p>Selecciona un producto para ver su historial de precios</p>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading">
        Cargando datos...
      </div>

      <!-- Error -->
      <div *ngIf="error" class="error">
        {{ error }}
      </div>
    </div>
  `,
  styleUrl: './price-history.component.css'
})
export class PriceHistoryComponent implements OnInit {
  selectedRange: PriceHistoryRange = 'W3';
  selectedProductId: string = '';
  priceData: PriceHistoryResponse | null = null;
  loading: boolean = false;
  error: string | null = null;
  productsWithAlerts: any[] = []; // Array con info de productos que tienen alertas
  alerts: Alert[] = [];

  constructor(
    private priceHistoryService: PriceHistoryService,
    private productsService: ProductsService,
    private tokenService: TokenService,
    private alertService: AlertService,
    private router: Router,
    private httpConfig: HttpConfigService
  ) {}

  ngOnInit(): void {
    this.loadAlertsWithProducts();
  }

  loadAlertsWithProducts(): void {
    this.loading = true;
    this.alertService.getAlerts().subscribe({
      next: (response) => {
        this.alerts = response.alerts;
        // Filtrar solo alertas activas
        const activeAlerts = this.alerts.filter(a => a.isActive !== false);
        
        // Convertir alertas a formato para mostrar en el dropdown
        this.productsWithAlerts = activeAlerts.map(alert => ({
          id: alert.productId,
          productName: alert.productRef || alert.productId,
          alertId: alert.id
        }));

        // Auto-seleccionar el primer producto si hay alertas
        if (this.productsWithAlerts.length > 0) {
          this.selectedProductId = this.productsWithAlerts[0].id;
          this.loadPriceHistory(this.selectedProductId);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando alertas:', err);
        this.loading = false;
      }
    });
  }

  private getCurrentUserId(): string {
    const profile = this.tokenService.getUserProfile();
    return profile?.id || localStorage.getItem('userId') || 'default-user';
  }

  onProductChange(): void {
    if (this.selectedProductId) {
      this.priceData = null;
      this.error = null;
      this.loadPriceHistory(this.selectedProductId);
    }
  }

  private loadPriceHistory(productId: string): void {
    console.log(`[PriceHistory] Cargando historial para productId=${productId}, range=${this.selectedRange}`);
    this.loading = true;
    this.priceHistoryService.getPriceHistory(productId, this.selectedRange).subscribe({
      next: (response) => {
        console.log('[PriceHistory] Datos recibidos:', response);
        this.priceData = response;
      },
      error: (err: any) => {
        console.error('[PriceHistory] Error completo:', {
          status: err?.status,
          statusText: err?.statusText,
          url: err?.url,
          headers: err?.headers,
          body: err?.error,
          message: err?.error?.message
        });

        // Si recibimos 500, intentar obtener el body crudo con fetch para diagnóstico
        if (err?.status === 500) {
          this.debugFetchPriceHistory(productId).catch((fetchErr) => {
            console.error('[PriceHistory] Debug fetch failed:', fetchErr);
          });
        }

        const msg = err?.error?.message || err?.statusText || 'Error desconocido del servidor';
        this.error = `Error (${err?.status}): ${msg}`;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  onRangeChange(): void {
    if (this.selectedProductId) {
      this.loadPriceHistory(this.selectedProductId);
    }
  }

  private async debugFetchPriceHistory(productId: string): Promise<void> {
    try {
      const url = `${this.httpConfig.getApiUrl()}/products/${productId}/priceHistory`;
      console.log(`[PriceHistory][debugFetch] fetching raw: ${url}`);
      const resp = await fetch(url, { method: 'GET', credentials: 'include' });
      const text = await resp.text();
      console.log('[PriceHistory][debugFetch] status:', resp.status, 'body:', text);
    } catch (err) {
      console.error('[PriceHistory][debugFetch] error:', err);
      throw err;
    }
  }

  getMinPrice(): number {
    if (!this.priceData) return 0;
    return Math.min(...this.priceData.history.map(h => h.price));
  }

  getMaxPrice(): number {
    if (!this.priceData) return 0;
    return Math.max(...this.priceData.history.map(h => h.price));
  }

  getAveragePrice(): number {
    if (!this.priceData) return 0;
    const sum = this.priceData.history.reduce((acc, h) => acc + h.price, 0);
    return sum / this.priceData.history.length;
  }

  goToAlerts(): void {
    this.router.navigate(['/alerts']);
  }
}
