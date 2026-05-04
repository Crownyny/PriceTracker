import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductsService } from '../products/services/products.service';
import { Product } from '../../shared/models/product.model';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-saved-products',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="saved-products-container">
      <h2>Productos Guardados</h2>

      <div *ngIf="loading" class="loading">
        Cargando productos guardados...
      </div>

      <div *ngIf="!loading && savedProducts.length > 0" class="products-list">
        <div *ngFor="let product of savedProducts" class="product-item">
          <div class="product-info">
            <h3>{{ product.name }}</h3>
            <p class="price">{{ product.currentPrice | currency }}</p>
            <p class="category">{{ product.category }}</p>
          </div>
          <div class="actions">
            <a [routerLink]="['/product', product.id]" [queryParams]="{ productRef: product.productRef }" class="view-btn">
              Ver detalles
            </a>
            <button (click)="removeProduct(product.id)" class="remove-btn">
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="!loading && savedProducts.length === 0" class="empty-state">
        <p>No tienes productos guardados aún</p>
        <a routerLink="/search" class="search-link">
          Ir a buscar productos →
        </a>
      </div>

      <div *ngIf="error" class="error-message">
        {{ error }}
      </div>
    </div>
  `,
  styles: [`
    .saved-products-container {
      padding: 20px;
    }
    .products-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-top: 20px;
    }
    .product-item {
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .product-info h3 {
      margin: 0;
    }
    .price {
      font-size: 18px;
      font-weight: bold;
      color: #28a745;
      margin: 5px 0;
    }
    .actions {
      display: flex;
      gap: 10px;
    }
    .view-btn, .remove-btn {
      padding: 8px 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .view-btn {
      background: #007bff;
      color: white;
    }
    .remove-btn {
      background: #dc3545;
      color: white;
      border: none;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }
  `]
})
export class SavedProductsComponent implements OnInit {
  savedProducts: Product[] = [];
  loading = false;
  error = '';

  constructor(private productsService: ProductsService) {}

  ngOnInit() {
    this.loadSavedProducts();
  }

  loadSavedProducts() {
    this.loading = true;
    // Obtener userId del localStorage o usar uno por defecto
    const userId = localStorage.getItem('userId') || 'default-user';
    this.productsService.getSavedProducts(userId).pipe(
      catchError(error => {
        this.error = 'Error cargando productos guardados';
        console.error(error);
        return of({ productRef: '', products: [], totalResults: 0 });
      })
    ).subscribe((response: any) => {
      this.savedProducts = response.products || [];
      this.loading = false;
    });
  }

  removeProduct(productId: string) {
    this.productsService.unsaveProduct(productId).subscribe(() => {
      this.savedProducts = this.savedProducts.filter(p => p.id !== productId);
    });
  }
}
