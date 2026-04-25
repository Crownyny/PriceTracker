import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PriceHistoryService } from '../services/price-history.service';
import { ProductsService } from '../../products/services/products.service';
import { TokenService } from '../../../core/services/token.service';
import { PriceHistoryResponse, PriceHistoryRange } from '../../../shared/models/price-history.model';

@Component({
  selector: 'app-price-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="price-history-container">
      <header>
        <h2>Historial de Precios</h2>
        <p>Analiza tendencias y encuentra el mejor momento para comprar</p>
      </header>

      <!-- Controls -->
      <div class="controls">
        <div class="search-section">
          <input 
            type="text" 
            placeholder="Buscar producto..."
            [(ngModel)]="searchQuery"
            (keyup.enter)="searchProduct()"
            class="search-input"
          />
          <button (click)="searchProduct()" class="search-btn">Buscar</button>
        </div>

        <div class="filter-section">
          <label>Rango:</label>
          <select [(ngModel)]="selectedRange" (change)="onRangeChange()">
            <option value="W1">Última Semana</option>
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
                <th>Disponibilidad</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let point of priceData.history.slice(0, 20)">
                <td>{{ point.updatedAt | date: 'short' }}</td>
                <td>{{ point.price | currency }}</td>
                <td>{{ point.source || '-' }}</td>
                <td>
                  <span [class.available]="point.availability" [class.unavailable]="!point.availability">
                    {{ point.availability ? 'Disponible' : 'No disponible' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!priceData && !loading" class="empty-state">
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
  searchQuery: string = '';
  selectedRange: PriceHistoryRange = 'W1';
  priceData: PriceHistoryResponse | null = null;
  loading: boolean = false;
  error: string | null = null;

  constructor(
    private priceHistoryService: PriceHistoryService,
    private productsService: ProductsService,
    private tokenService: TokenService
  ) {}

  ngOnInit(): void {
    // Podría cargar datos iniciales
  }

  searchProduct(): void {
    if (!this.searchQuery.trim()) {
      this.error = 'Ingresa un término de búsqueda';
      return;
    }

    this.loading = true;
    this.error = null;

    this.productsService.searchProducts(this.searchQuery).subscribe({
      next: (response) => {
        if (response.products.length > 0) {
          this.loadPriceHistory(response.products[0].id);
        } else {
          this.error = 'No se encontraron productos';
        }
      },
      error: (err) => {
        this.error = 'Error al buscar productos';
        this.loading = false;
      }
    });
  }

  private loadPriceHistory(productId: string): void {
    this.priceHistoryService.getPriceHistory(productId, this.selectedRange).subscribe({
      next: (response) => {
        this.priceData = response;
      },
      error: (err) => {
        this.error = 'Error al cargar historial de precios';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  onRangeChange(): void {
    if (this.priceData) {
      this.loadPriceHistory(this.priceData.productId);
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
}
