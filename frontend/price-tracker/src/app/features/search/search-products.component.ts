import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ProductsService } from '../products/services/products.service';
import { StompWebSocketService } from '../../core/services/stomp-websocket.service';
import { Product } from '../../shared/models/product.model';
import { catchError, merge, of, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProductSearchResponse } from '../../shared/models/product.model';

@Component({
  selector: 'app-search-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './search-products.component.html',
  styleUrl: './search-products.component.css'
})
export class SearchProductsComponent implements OnInit, OnDestroy {
  searchQuery = '';
  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = false;
  searching = false; // Para indicar búsqueda actual
  error = '';
  searchStatus = ''; // Para mostrar estado de búsqueda
  usingStomp = false; // Indicador visual si se usa STOMP
  stompConnected = false; // Estado de conexión STOMP
  lastSearchRef = '';
  uiState: 'idle' | 'loading' | 'in-progress' | 'found' | 'empty' | 'error' = 'idle';

  private destroy$ = new Subject<void>();
  private searchSession$ = new Subject<void>();

    constructor(
      private productsService: ProductsService,
      private stompService: StompWebSocketService,
      private router: Router
    ) {}

  ngOnInit() {
    // Importante: el servicio NO se conecta solo; si no llamamos connect(),
    // Angular nunca se suscribe a `/user/queue/products` (tu prueba.html sí lo hace).
    this.stompService.connect();

    // Monitorear estado de STOMP
    this.stompService.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected: boolean) => {
        this.stompConnected = connected;
      });

    // Escuchar mensajes de estado del backend
    this.stompService.status$
      .pipe(takeUntil(this.destroy$))
      .subscribe((status: any) => {
        this.searchStatus = status.message;
        if (status.status === 'complete') {
          this.searching = false;
        }
      });

    // Escuchar errores del backend
    this.stompService.errors$
      .pipe(takeUntil(this.destroy$))
      .subscribe((errorMsg: any) => {
        this.error = errorMsg.message;
        this.searching = false;
      });

    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.searchSession$.next();
    this.searchSession$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProducts() {
    this.loading = true;
    this.uiState = 'loading';
    // Buscar todos los productos con query vacía
    this.productsService.searchProducts('').pipe(
      catchError(error => {
        this.error = 'Error cargando productos';
        console.error(error);
        return of({ productRef: '', products: [], totalResults: 0 });
      }),
      takeUntil(this.destroy$)
    ).subscribe((response: any) => {
      this.products = response.products || [];
      this.filteredProducts = this.products;
      this.loading = false;
      this.usingStomp = this.stompConnected;
      this.uiState = this.filteredProducts.length > 0 ? 'found' : 'idle';
    });
  }

  onSearch() {
    this.error = ''; // Limpiar error previo
    // Cancela streams de una búsqueda anterior
    this.searchSession$.next();
    
    if (this.searchQuery.trim()) {
      this.searching = true;
      this.searchStatus = 'Buscando productos...';
      this.usingStomp = this.stompConnected; // Mostrar si se usa STOMP
      this.uiState = 'loading';
      const productRef = this.searchQuery.trim().replace(/\s+/g, '').toLowerCase();
      this.lastSearchRef = productRef;

      // 1) REST primero: buscar en BD por `product_ref` (más rápido si ya existe/recent).
      this.productsService.getSearchFromDb(productRef).pipe(
        catchError((error) => {
          console.error(error);
          return of({ productRef, products: [], totalResults: 0 } as ProductSearchResponse);
        }),
        takeUntil(merge(this.destroy$, this.searchSession$))
      ).subscribe((dbResponse) => {
        const dbProducts = dbResponse.products || [];
        if (dbProducts.length > 0) {
          this.filteredProducts = dbProducts;
          this.searching = false;
          this.searchStatus = '';
          this.uiState = 'found';
          return;
        }

        // 2) Si no hay resultados en BD, usar WebSocket (si está conectado).
        if (!this.stompConnected) {
          this.error = 'WebSocket desconectado. No hay resultados en BD.';
          this.searching = false;
          this.searchStatus = '';
          this.uiState = 'error';
          return;
        }

        this.searchStatus = 'Búsqueda en progreso (tiempo real)...';
        this.filteredProducts = [];
        this.uiState = 'in-progress';

        // Enviar búsqueda (misma destination que `prueba ac.html`)
        this.stompService.sendSearchCommand(this.searchQuery, productRef);

        // Escuchar productos en tiempo real SOLO para esta búsqueda
        this.stompService.products$
          .pipe(takeUntil(merge(this.destroy$, this.searchSession$)))
          .subscribe((message: any) => {
            const msgRef = String(message?.productRef ?? message?.product_ref ?? '').trim();
            if (msgRef && msgRef !== this.lastSearchRef) return;

            const incoming = Array.isArray(message?.products) ? message.products : [];
            this.filteredProducts = incoming as Product[];
            this.uiState = this.filteredProducts.length > 0 ? 'found' : 'in-progress';
          });
      });
    } else {
      // Si no hay query, mostrar todos
      this.filteredProducts = this.products;
      this.searching = false;
      this.searchStatus = '';
      this.uiState = this.filteredProducts.length > 0 ? 'found' : 'idle';
    }
  }

  clearSearch() {
    this.searchQuery = '';
    this.filteredProducts = this.products;
    this.searchStatus = '';
    this.error = '';
    this.uiState = this.filteredProducts.length > 0 ? 'found' : 'idle';
  }

  saveProduct(product: Product) {
    this.router.navigate(['/alerts'], {
      queryParams: { productId: product.id }
    });
  }

  openProductDetail(product: Product): void {
    this.router.navigate(['/product', product.id], {
      queryParams: { productRef: product.productRef || product.id },
      state: { product }
    });
  }
}


