import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductsService } from '../products/services/products.service';
import { StompWebSocketService } from '../../core/services/stomp-websocket.service';
import { Product } from '../../shared/models/product.model';
import { catchError, of, Subject } from 'rxjs';
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

  private destroy$ = new Subject<void>();

  constructor(
    private productsService: ProductsService,
    private stompService: StompWebSocketService
  ) {}

  ngOnInit() {
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
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProducts() {
    this.loading = true;
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
    });
  }

  onSearch() {
    this.error = ''; // Limpiar error previo
    
    if (this.searchQuery.trim()) {
      this.searching = true;
      this.searchStatus = 'Buscando productos...';
      this.usingStomp = this.stompConnected; // Mostrar si se usa STOMP

      // Si hay query, buscar en el backend
      this.productsService.searchProducts(this.searchQuery).pipe(
        catchError(error => {
          this.error = 'Error buscando productos';
          console.error(error);
          this.searching = false;
          return of({ productRef: '', products: [], totalResults: 0 });
        }),
        takeUntil(this.destroy$)
      ).subscribe((response: any) => {
        this.filteredProducts = response.products || [];
        this.searching = false;
        this.searchStatus = '';
      });
    } else {
      // Si no hay query, mostrar todos
      this.filteredProducts = this.products;
      this.searching = false;
      this.searchStatus = '';
    }
  }

  clearSearch() {
    this.searchQuery = '';
    this.filteredProducts = this.products;
    this.searchStatus = '';
    this.error = '';
  }

  saveProduct(product: Product) {
    console.log('Producto guardado:', product.name);
    // Aquí irá la lógica de backend para guardar producto
  }
}
