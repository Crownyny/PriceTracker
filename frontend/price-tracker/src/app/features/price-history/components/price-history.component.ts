import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PriceHistoryService } from '../services/price-history.service';
import { ProductsService } from '../../products/services/products.service';
import { TokenService } from '../../../core/services/token.service';
import { UserRoleService } from '../../../core/services/user-role.service';
import { AlertService } from '../../alerts/services/alert.service';
import { PriceHistoryResponse, PriceHistoryRange, PriceHistoryPoint } from '../../../shared/models/price-history.model';
import { Alert } from '../../../shared/models/alert.model';

interface ProductWithAlert {
  id: string;          // productId — solo para llamadas internas
  productName: string; // nombre legible — lo que el usuario ve
  alertId: string;
}

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

      <!-- Controles -->
      <div class="controls">
        <div class="alerts-products-section">
          <label for="productSelect">Producto con alerta:</label>
          <select
            id="productSelect"
            [(ngModel)]="selectedProductId"
            (change)="onProductChange()"
            class="product-select"
            [disabled]="loading || productsWithAlerts.length === 0"
          >
            <option value="">-- Selecciona un producto --</option>
            <option *ngFor="let p of productsWithAlerts" [value]="p.id">
              {{ p.productName }}
            </option>
          </select>
        </div>

        <div class="create-alert-section">
          <button (click)="goToAlerts()" class="create-alert-btn">+ Crear Alerta</button>
        </div>

        <div class="filter-section">
          <label>Rango:</label>
          <select [(ngModel)]="selectedRange" (change)="onRangeChange()">
            <option value="W1">1 Semana</option>
            <option value="W3">3 Semanas</option>
            <option value="W12">3 Meses</option>
            <option value="ALL">Todo el historial</option>
          </select>
        </div>
      </div>

      <!-- Estadísticas + tabla -->
      <div class="chart-section" *ngIf="priceData && priceData.history.length > 0 && !loading">
        <div class="price-stats">
          <div class="stat">
            <span class="label">Precio más reciente</span>
            <span class="value">{{ lastPrice() | currency:'COP':'symbol':'1.0-0' }}</span>
          </div>
          <div class="stat">
            <span class="label">Precio mínimo</span>
            <span class="value">{{ getMinPrice() | currency:'COP':'symbol':'1.0-0' }}</span>
          </div>
          <div class="stat">
            <span class="label">Precio máximo</span>
            <span class="value">{{ getMaxPrice() | currency:'COP':'symbol':'1.0-0' }}</span>
          </div>
          <div class="stat">
            <span class="label">Precio promedio</span>
            <span class="value">{{ getAveragePrice() | currency:'COP':'symbol':'1.0-0' }}</span>
          </div>
        </div>

        <!-- Tabla de historial -->
        <div class="price-table">
          <table>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Precio</th>
                <th>Tienda</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let point of priceData.history.slice(0, 30)">
                <td>{{ formatDate(point.updatedAt) }}</td>
                <td>{{ point.price | currency:'COP':'symbol':'1.0-0' }}</td>
                <td>{{ getSource(point) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sin datos en el rango seleccionado -->
      <div *ngIf="priceData && priceData.history.length === 0 && !loading" class="empty-state">
        <p>No hay registros de precio en el rango seleccionado.</p>
        <p><small>Prueba con un rango más amplio.</small></p>
      </div>

      <!-- Sin alertas -->
      <div *ngIf="!loading && productsWithAlerts.length === 0" class="empty-state no-alerts">
        <h3>No tienes alertas de precios activadas</h3>
        <p>Crea alertas para monitorear productos y ver su historial de precios</p>
        <button (click)="goToAlerts()" class="action-btn">Crear tu primera alerta</button>
      </div>

      <!-- Sin producto seleccionado -->
      <div *ngIf="!priceData && !loading && productsWithAlerts.length > 0" class="empty-state">
        <p>Selecciona un producto para ver su historial de precios.</p>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading">
        <span>Cargando datos…</span>
      </div>

      <!-- Error -->
      <div *ngIf="error && !loading" class="error">
        {{ error }}
      </div>
    </div>
  `,
  styleUrl: './price-history.component.css'
})
export class PriceHistoryComponent implements OnInit {
  selectedRange: PriceHistoryRange = 'W3';
  selectedProductId = '';
  priceData: PriceHistoryResponse | null = null;
  loading = false;
  error: string | null = null;
  productsWithAlerts: ProductWithAlert[] = [];
  alerts: Alert[] = [];

  constructor(
    private priceHistoryService: PriceHistoryService,
    private productsService: ProductsService,
    private tokenService: TokenService,
    private userRoleService: UserRoleService,
    private alertService: AlertService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.selectedRange = this.userRoleService.canUsePremiumFeatures() ? 'W3' : 'W1';
    this.loadAlertsWithProducts();
  }

  // ── Cargar alertas y resolver nombres de producto ─────────────────────────

  loadAlertsWithProducts(): void {
    this.loading = true;
    this.error = null;

    this.alertService.getAlerts().subscribe({
      next: (response) => {
        this.alerts = response.alerts;
        const activeAlerts = this.alerts.filter(a => a.isActive !== false);

        if (activeAlerts.length === 0) {
          this.productsWithAlerts = [];
          this.loading = false;
          return;
        }

        // Para cada alerta intentamos resolver el nombre del producto.
        // Estrategia: si tiene productRef buscamos en DB; si no, usamos productRef como nombre
        // o en último caso mostramos un placeholder amigable.
        const requests = activeAlerts.map((alert) => {
          const searchRef = String(alert.productRef || '').trim();

          // Si no hay ref buscable, devolvemos un item con nombre placeholder
          if (!searchRef) {
            return of<ProductWithAlert>({
              id: alert.productId,
              productName: `Producto (sin referencia)`,
              alertId: alert.id
            });
          }

          return this.productsService.getSearchFromDb(searchRef).pipe(
            map((dbResponse) => {
              // Buscar primero el producto exacto por id, luego cualquiera del resultado
              const match =
                dbResponse.products.find((p) => p.id === alert.productId) ||
                dbResponse.products[0];

              return <ProductWithAlert>{
                id: alert.productId,
                // Si encontramos el producto usamos su nombre, si no el ref es ya legible
                productName: match?.name || searchRef,
                alertId: alert.id
              };
            }),
            catchError(() =>
              of<ProductWithAlert>({
                id: alert.productId,
                productName: searchRef,   // el ref suele ser legible (ej: "samsung-tv-55")
                alertId: alert.id
              })
            )
          );
        });

        forkJoin(requests).subscribe({
          next: (items) => {
            this.productsWithAlerts = items;

            if (this.productsWithAlerts.length > 0) {
              this.selectedProductId = this.productsWithAlerts[0].id;
              this.loadPriceHistory(this.selectedProductId);
            } else {
              this.loading = false;
            }
          },
          error: () => {
            // Fallback: usar lo que tengamos sin nombres bonitos
            this.productsWithAlerts = activeAlerts.map((alert) => ({
              id: alert.productId,
              productName: alert.productRef || `Producto ${alert.productId.slice(0, 8)}`,
              alertId: alert.id
            }));

            if (this.productsWithAlerts.length > 0) {
              this.selectedProductId = this.productsWithAlerts[0].id;
              this.loadPriceHistory(this.selectedProductId);
            } else {
              this.loading = false;
            }
          }
        });
      },
      error: (err) => {
        console.error('Error cargando alertas:', err);
        this.error = 'No se pudieron cargar las alertas.';
        this.loading = false;
      }
    });
  }

  // ── Carga del historial ───────────────────────────────────────────────────

  onProductChange(): void {
    if (this.selectedProductId) {
      this.priceData = null;
      this.error = null;
      this.loadPriceHistory(this.selectedProductId);
    }
  }

  onRangeChange(): void {
    if (this.selectedProductId) {
      this.loadPriceHistory(this.selectedProductId);
    }
  }

  private loadPriceHistory(productId: string): void {
    this.loading = true;
    this.error = null;

    this.priceHistoryService
      .getPriceHistory(productId, this.selectedRange)
      .subscribe({
        next: (response) => {
          this.priceData = response;
          this.loading = false;
        },
        error: (err: any) => {
          const msg =
            err?.error?.message || err?.statusText || 'Error desconocido del servidor';
          this.error = `Error al cargar historial (${err?.status ?? '?'}): ${msg}`;
          this.loading = false;
        }
      });
  }

  // ── Helpers de template ───────────────────────────────────────────────────

  /** Precio más reciente = último elemento del array (orden cronológico) */
  lastPrice(): number {
    if (!this.priceData?.history.length) return 0;
    return this.priceData.history[this.priceData.history.length - 1].price;
  }

  getMinPrice(): number {
    if (!this.priceData?.history.length) return 0;
    return Math.min(...this.priceData.history.map((h) => h.price));
  }

  getMaxPrice(): number {
    if (!this.priceData?.history.length) return 0;
    return Math.max(...this.priceData.history.map((h) => h.price));
  }

  getAveragePrice(): number {
    if (!this.priceData?.history.length) return 0;
    const sum = this.priceData.history.reduce((acc, h) => acc + h.price, 0);
    return sum / this.priceData.history.length;
  }

  /**
   * Formatea la fecha del punto de historial de forma legible.
   * El campo puede ser un Date, un string ISO o un timestamp.
   */
  formatDate(raw: Date | string | undefined | null): string {
    if (!raw) return '—';
    try {
      const d = raw instanceof Date ? raw : new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      return d.toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(raw);
    }
  }

  /**
   * Extrae el nombre de la tienda del punto de historial.
   * El backend puede enviarlo como `sourceName`, `source`, o no enviarlo.
   */
  getSource(point: PriceHistoryPoint): string {
    return (point as any).sourceName || point.source || '—';
  }

  goToAlerts(): void {
    this.router.navigate(['/alerts']);
  }
}