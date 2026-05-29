import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, merge, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, take, takeUntil } from 'rxjs/operators';
import { ProductsService } from '../products/services/products.service';
import { UserRoleService } from '../../core/services/user-role.service';
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

  savedProductIds: Set<string> = new Set();
  savingProducts:  Set<string> = new Set();

  // ── Filtros ───────────────────────────────────────────────────────────────
  selectedPriceRange   = 'all';
  selectedAvailability = 'all';
  selectedStore        = 'all';  // 'all' | nombre de tienda

  /** Tiendas únicas disponibles en los resultados actuales */
  get availableStores(): string[] {
    const stores = this.filteredProducts
      .map(p => p.source)
      .filter((s): s is string => !!s);
    return [...new Set(stores)].sort();
  }

  // Productos con filtros aplicados (computed sobre filteredProducts)
  get displayedProducts(): Product[] {
    return this.filteredProducts.filter(p => {
      // Filtro de precio (valores en COP)
      if (this.selectedPriceRange !== 'all') {
        const price = p.currentPrice;
        if (this.selectedPriceRange === 'lt100k'     && price >= 100_000)  return false;
        if (this.selectedPriceRange === '100k-500k'  && (price < 100_000  || price > 500_000)) return false;
        if (this.selectedPriceRange === '500k-1m'    && (price < 500_000  || price > 1_000_000)) return false;
        if (this.selectedPriceRange === 'gt1m'       && price <= 1_000_000) return false;
      }
      // Filtro de disponibilidad
      if (this.selectedAvailability === 'instock'    && !p.availability)  return false;
      if (this.selectedAvailability === 'outofstock' &&  p.availability)  return false;
      // Filtro por tienda
      if (this.selectedStore !== 'all' && p.source !== this.selectedStore) return false;
      return true;
    });
  }

  private destroy$       = new Subject<void>();
  private searchSession$ = new Subject<void>();
  private queryInput$    = new Subject<string>();

  constructor(
    private productsService: ProductsService,
    private userRoleService: UserRoleService,
    private stompService:    StompWebSocketService,
    private route:  ActivatedRoute,
    private router: Router,
    private cdr:    ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.stompService.connect();

    // Sincronizar IDs guardados para mostrar estado correcto en tarjetas
    this.productsService.syncSavedIds().subscribe(ids => {
      this.savedProductIds = new Set(ids);
      this.cdr.markForCheck();
    });

    // Si viene con ?q= desde alertas, prellenar y ejecutar búsqueda automáticamente
    const queryParam = this.route.snapshot.queryParamMap.get('q');
    if (queryParam?.trim()) {
      this.searchQuery = queryParam.trim();
      // Esperar a que STOMP conecte antes de buscar
      this.stompService.connected$.pipe(
        filter((connected: boolean) => connected),
        take(1),
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.runSearch(this.searchQuery);
      });
      // También intentar búsqueda en BD inmediatamente (no necesita WebSocket)
      this.runSearch(this.searchQuery);
    }

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
    this.lastSearchRef   = productRef;
    this.selectedStore   = 'all';  // resetear filtro de tienda en nueva búsqueda
    this.searching       = true;
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

      // Escuchar productos en tiempo real solo para esta búsqueda.
      // El backend envía UN NormalizedProductDTO por mensaje (no un array).
      this.stompService.products$
        .pipe(takeUntil(merge(this.destroy$, this.searchSession$)))
        .subscribe((message: any) => {
          // Filtrar por productRef si viene — normalizar a lowercase sin espacios
          const msgRef = String(message?.product_ref ?? message?.productRef ?? '').replace(/\s+/g, '').toLowerCase().trim();
          if (msgRef && msgRef !== this.lastSearchRef) return;

          // El backend envía un producto individual, no un array
          const product: Product | null = message?.id
            ? this.productsService.mapBackendProduct(message)
            : null;

          if (product) {
            // Acumular productos — pueden llegar varios mensajes (uno por tienda)
            const alreadyExists = this.filteredProducts.some(p => p.id === product.id);
            if (!alreadyExists) {
              this.filteredProducts = [...this.filteredProducts, product];
            }
            this.uiState      = 'found';
            this.searching    = false;
            this.searchStatus = '';
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

  isProductSaved(productId: string): boolean {
    return this.savedProductIds.has(productId);
  }

  isSaving(productId: string): boolean {
    return this.savingProducts.has(productId);
  }

  toggleSave(product: Product): void {
    if (this.savingProducts.has(product.id)) return;

    const isPremium = this.userRoleService.canUsePremiumFeatures();
    const isSaved   = this.savedProductIds.has(product.id);

    if (!isSaved && !isPremium && this.savedProductIds.size >= 5) {
      // Verificar contra backend antes de mostrar error
      this.productsService.syncSavedIds().subscribe(ids => {
        this.savedProductIds = new Set(ids);
        if (ids.length >= 5) {
          this.router.navigate(['/account']);  // llevar a Mi Cuenta para hacer upgrade
        } else {
          this.executeSave(product, false);
        }
        this.cdr.markForCheck();
      });
      return;
    }

    this.executeSave(product, isSaved);
  }

  private executeSave(product: Product, isSaved: boolean): void {
    this.savingProducts.add(product.id);
    this.cdr.markForCheck();

    const action$ = isSaved
      ? this.productsService.unsaveProduct(product.id)
      : this.productsService.saveProduct(product.id);

    action$.subscribe({
      next: () => {
        if (isSaved) {
          this.savedProductIds.delete(product.id);
        } else {
          this.savedProductIds.add(product.id);
        }
        this.savingProducts.delete(product.id);
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingProducts.delete(product.id);
        this.cdr.markForCheck();
      }
    });
  }

  createAlert(product: Product): void {
    this.router.navigate(['/alerts'], {
      queryParams: { productId: product.id }
    });
  }
}