import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { ProductsService } from '../products/services/products.service';
import { Product } from '../../shared/models/product.model';
import { TokenService } from '../../core/services/token.service';

@Component({
  selector: 'app-saved-products',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './saved-products.component.html',
  styleUrl: './saved-products.component.css'
})
export class SavedProductsComponent implements OnInit {
  savedProducts: Product[] = [];
  loading  = false;
  removing: Set<string> = new Set();
  error    = '';

  constructor(
    private productsService: ProductsService,
    private tokenService:    TokenService,
    private router:          Router,
    private cdr:             ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSavedProducts();
  }

  loadSavedProducts(): void {
    this.loading = true;
    this.error   = '';
    const userId = this.tokenService.getUserProfile()?.id ?? '';

    this.productsService.getSavedProducts(userId).pipe(
      catchError(() => {
        this.error = 'No se pudieron cargar los productos guardados.';
        return of({ productRef: '', products: [], totalResults: 0 });
      }),
      finalize(() => { this.loading = false; this.cdr.markForCheck(); })
    ).subscribe(response => {
      this.savedProducts = response.products ?? [];
      this.cdr.markForCheck();
    });
  }

  goToProduct(product: Product): void {
    this.router.navigate(['/product', product.id], {
      queryParams: { productRef: product.productRef }
    });
  }

  removeProduct(productId: string): void {
    this.removing.add(productId);
    this.productsService.unsaveProduct(productId).pipe(
      finalize(() => { this.removing.delete(productId); this.cdr.markForCheck(); })
    ).subscribe({
      next: () => {
        this.savedProducts = this.savedProducts.filter(p => p.id !== productId);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudo eliminar el producto. Intenta de nuevo.';
        this.cdr.markForCheck();
      }
    });
  }

  isRemoving(productId: string): boolean {
    return this.removing.has(productId);
  }

  fmtPrice(price: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(price);
  }
}