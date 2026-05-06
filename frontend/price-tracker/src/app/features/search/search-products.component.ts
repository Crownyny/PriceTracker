import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, merge, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ProductsService } from '../products/services/products.service';
import { StompWebSocketService } from '../../core/services/stomp-websocket.service';
import { Product, ProductSearchResponse } from '../../shared/models/product.model';

@Component({
  selector: 'app-search-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './search-products.component.html',
  styleUrl: './search-products.component.css'
})
export class SearchProductsComponent implements OnInit, OnDestroy {

  searchQuery       = '';
  filteredProducts: Product[] = [];
  loading           = false;
  searching         = false;
  error             = '';
  searchStatus      = '';
  stompConnected    = false;
  lastSearchRef     = '';
  uiState: 'idle' | 'loading' | 'in-progress' | 'found' | 'empty' | 'error' = 'idle';

  private destroy$       = new Subject<void>();
  private searchSession$ = new Subject<void>();
  private queryInput$    = new Subject<string>();

  constructor(
    private productsService: ProductsService,
    private stompService:    StompWebSocketService,
    private router:          Router,
    private cdr:             ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.stompService.connect();

    // Estado de conexión STOMP
    this.stompService.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected: boolean) => {
        this.stompConnected = connected;
        this.cdr.markForCheck();
      });

    // Mensajes de estado del backend
    this.stompService.status$
      .pipe(takeUntil(this.destroy$))
      .subscribe((status: any) => {
        const msg  = String(status?.message ?? '');
        const code = String(status?.status  ?? '');

        // PRODUCT_IN_BD = producto ya en BD → buscar por REST
        if (msg === 'PRODUCT_IN_BD' || msg.includes('PRODUCT_IN_BD')) {
          if (this.lastSearchRef && this.filteredProducts.length === 0) {
            this.productsService.getSearchFromDb(this.lastSearchRef).pipe(
              catchError(() => of({ productRef: this.lastSearchRef, products: [], totalResults: 0 } as ProductSearchResponse))
            ).subscribe(resp => {
              if (resp.products.length > 0) {
                this.filteredProducts = resp.products;
                this.uiState          = 'found';
                this.searching        = false;
                this.searchStatus     = '';
                this.error            = '';
              }
              this.cdr.markForCheck();
            });
          }
          return;
        }

        this.searchStatus = msg;
        if (code === 'complete') {
          this.searching = false;
          if (this.filteredProducts.length === 0) this.uiState = 'empty';
        }
        this.cdr.markForCheck();
      });

    // Errores del backend
    this.stompService.errors$
      .pipe(takeUntil(this.destroy$))
      .subscribe((errorMsg: any) => {
        const msg = String(errorMsg?.message ?? errorMsg?.code ?? '');

        // PRODUCT_IN_BD por canal errors → buscar por REST
        if (msg === 'PRODUCT_IN_BD' || msg.includes('PRODUCT_IN_BD')) {
          if (this.lastSearchRef) {
            this.searchStatus = 'Producto encontrado en base de datos…';
            this.cdr.markForCheck();
            this.productsService.getSearchFromDb(this.lastSearchRef).pipe(
              catchError(() => of({ productRef: this.lastSearchRef, products: [], totalResults: 0 } as ProductSearchResponse))
            ).subscribe(resp => {
              if (resp.products.length > 0) {
                this.filteredProducts = resp.products;
                this.uiState          = 'found';
              } else {
                this.uiState = 'empty';
              }
              this.searching    = false;
              this.searchStatus = '';
              this.error        = '';
              this.cdr.markForCheck();
            });
          }
          return;
        }

        this.error     = msg || 'Error en la búsqueda';
        this.searching = false;
        this.uiState   = 'error';
        this.cdr.markForCheck();
      });

    // Debounce de 400ms para no lanzar una petición por cada tecla
    this.queryInput$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => this.runSearch(query));
  }

  ngOnDestroy(): void {
    this.searchSession$.next();
    this.searchSession$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Input handlers ────────────────────────────────────────────────────────

  onQueryChange(): void {
    this.queryInput$.next(this.searchQuery);
  }

  onSearch(): void {
    // Clic en botón → búsqueda inmediata
    this.runSearch(this.searchQuery);
  }

  onKeyEnter(): void {
    this.runSearch(this.searchQuery);
  }

  clearSearch(): void {
    this.searchQuery      = '';
    this.filteredProducts = [];
    this.error            = '';
    this.searchStatus     = '';
    this.uiState          = 'idle';
    this.cdr.markForCheck();
  }

  // ── Core search ───────────────────────────────────────────────────────────

  private runSearch(query: string): void {
    const trimmed = query.trim();

    if (!trimmed) {
      this.filteredProducts = [];
      this.uiState          = 'idle';
      this.searching        = false;
      this.cdr.markForCheck();
      return;
    }

    // Cancelar búsqueda anterior
    this.searchSession$.next();

    const productRef    = trimmed.replace(/\s+/g, '').toLowerCase();
    this.lastSearchRef  = productRef;
    this.searching      = true;
    this.error          = '';
    this.searchStatus   = 'Buscando en la base de datos…';
    this.uiState        = 'loading';
    this.filteredProducts = [];
    this.cdr.markForCheck();

    // 1) BD primero
    this.productsService.getSearchFromDb(productRef).pipe(
      catchError(() => of({ productRef, products: [], totalResults: 0 } as ProductSearchResponse)),
      takeUntil(merge(this.destroy$, this.searchSession$))
    ).subscribe(dbResp => {
      const dbProducts = dbResp.products ?? [];

      if (dbProducts.length > 0) {
        this.filteredProducts = dbProducts;
        this.searching        = false;
        this.searchStatus     = '';
        this.uiState          = 'found';
        this.cdr.markForCheck();
        return;
      }

      // 2) Sin resultados en BD → WebSocket (scraping en tiempo real)
      if (!this.stompConnected) {
        this.searching    = false;
        this.searchStatus = '';
        this.uiState      = 'empty';
        this.cdr.markForCheck();
        return;
      }

      this.searchStatus = 'Búsqueda en tiempo real…';
      this.uiState      = 'in-progress';
      this.cdr.markForCheck();

      this.stompService.sendSearchCommand(trimmed, productRef);

      // Escuchar productos en tiempo real solo para esta búsqueda
      this.stompService.products$
        .pipe(takeUntil(merge(this.destroy$, this.searchSession$)))
        .subscribe((message: any) => {
          const msgRef = String(message?.productRef ?? message?.product_ref ?? '').trim();
          if (msgRef && msgRef !== this.lastSearchRef) return;

          const raw: any[]      = message?.products ?? [];
          const incoming: Product[] = raw.map(p => this.productsService.mapBackendProduct(p));

          if (incoming.length > 0) {
            this.filteredProducts = incoming;
            this.uiState          = 'found';
            this.searching        = false;
            this.searchStatus     = '';
            this.cdr.markForCheck();
          }
        });
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  openProductDetail(product: Product): void {
    this.productsService.cacheFullProduct(product);
    this.router.navigate(['/product', product.id], {
      queryParams: { productRef: product.productRef || this.lastSearchRef },
      state:       { productResult: { best: product, all: this.filteredProducts } }
    });
  }

  createAlert(product: Product): void {
    this.router.navigate(['/alerts'], {
      queryParams: { productId: product.id }
    });
  }
}