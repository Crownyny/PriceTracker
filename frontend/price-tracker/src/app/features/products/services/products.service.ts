import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin, of } from 'rxjs';
import { filter, map, switchMap, timeout, take, catchError as rxCatchError } from 'rxjs/operators';
import { HttpConfigService } from '../../../core/services/http-config.service';
import { StompWebSocketService } from '../../../core/services/stomp-websocket.service';
import { Product, ProductSearchResponse } from '../../../shared/models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly SAVED_KEY        = 'saved_product_ids_';
  private readonly SEARCHED_KEY     = 'searched_product_refs_';
  private readonly FREE_SAVED_LIMIT = 5;

  /** Emite cuando el estado de guardado cambia — el dashboard puede suscribirse para refrescarse */
  readonly savedChanged$ = new BehaviorSubject<void>(undefined);

  constructor(
    private http: HttpClient,
    private httpConfig: HttpConfigService,
    private stompService: StompWebSocketService
  ) {}

  // ── Mapping ───────────────────────────────────────────────────────────────
  // Campos confirmados del backend (GET /api/products/{id}/product):
  // id, product_ref, source_name, canonical_name, price, currency,
  // category, availability, source_url, image_url, description

  mapBackendProduct(raw: any): Product {
    return {
      id:             String(raw.id ?? raw.product_id ?? raw.productId ?? ''),
      productRef:     raw.product_ref    ?? raw.productRef   ?? '',
      name:           raw.canonical_name ?? raw.canonicalName ?? raw.name ?? '',
      ean:            raw.ean,
      category:       raw.category,
      image:          raw.image_url      ?? raw.imageUrl     ?? raw.image,
      description:    raw.description,
      currentPrice:   Number(raw.price   ?? raw.currentPrice ?? 0),
      currency:       raw.currency       ?? 'COP',
      availability:   raw.availability   !== false,
      source:         raw.source_name    ?? raw.sourceName   ?? raw.source,
      url:            raw.source_url     ?? raw.sourceUrl    ?? raw.url,
      bestPrice:      raw.best_price     ?? raw.bestPrice,
      savings:        raw.savings,
      savingsPercent: raw.savings_percent ?? raw.savingsPercent,
    } as Product;
  }

  // ── User ID ───────────────────────────────────────────────────────────────

  private getCurrentUserId(): string {
    try {
      const p = sessionStorage.getItem('user_profile') ?? localStorage.getItem('user_profile');
      if (p) return (JSON.parse(p) as any)?.id ?? '';
    } catch { /* ignore */ }
    return localStorage.getItem('userId') ?? 'default-user';
  }

  // ── Saved products (backend + localStorage cache) ──────────────────────────

  isProductSaved(productId: string): boolean {
    return this.readSavedIds().includes(productId);
  }

  getSavedCount(): number {
    return this.readSavedIds().length;
  }

  /**
   * Downgrade: recorta la wishlist al límite freemium (5).
   * 1. Consulta el backend para obtener los items ordenados por createdAt
   * 2. Conserva los 5 más recientes (por fecha real del backend)
   * 3. Llama DELETE en el backend para cada item excedente
   */
  trimSavedToFreeLimit(): Observable<void> {
    return this.http.get<{ id: string; productId: string; createdAt: string }[]>(
      `${this.httpConfig.getApiUrl()}/wishlist`
    ).pipe(
      switchMap(items => {
        if (items.length <= this.FREE_SAVED_LIMIT) {
          // Ya está dentro del límite — solo sincronizar localStorage
          this.writeSavedIds(items.map(i => i.productId));
          return of(undefined as void);
        }
        // Ordenar por createdAt descendente y tomar los más recientes
        const sorted  = [...items].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const keep    = sorted.slice(0, this.FREE_SAVED_LIMIT);
        const remove  = sorted.slice(this.FREE_SAVED_LIMIT);

        this.writeSavedIds(keep.map(i => i.productId));

        // Llamar DELETE en el backend para cada excedente
        const deletes$ = remove.map(item =>
          this.http.delete<void>(
            `${this.httpConfig.getApiUrl()}/wishlist/product/${encodeURIComponent(item.productId)}`
          ).pipe(rxCatchError(() => of(undefined as void)))
        );

        return forkJoin(deletes$).pipe(map(() => undefined as void));
      }),
      rxCatchError(() => {
        // Fallback: recorte local si el backend no responde
        const ids = this.readSavedIds();
        if (ids.length > this.FREE_SAVED_LIMIT) {
          this.writeSavedIds(ids.slice(0, this.FREE_SAVED_LIMIT));
        }
        return of(undefined as void);
      })
    );
  }

  /**
   * Guarda un producto en la wishlist del backend.
   * También actualiza el caché local para que la UI sea inmediata.
   * Si el producto ya estaba guardado (409), lo trata como éxito silencioso.
   */
  saveProduct(productId: string): Observable<{ message: string }> {
    const ids = this.readSavedIds();
    if (!ids.includes(productId)) this.writeSavedIds([...ids, productId]);
    return this.http.post<{ message: string }>(
      `${this.httpConfig.getApiUrl()}/wishlist/product/${encodeURIComponent(productId)}`,
      {}
    ).pipe(
      map(() => { this.savedChanged$.next(); return { message: 'OK' }; }),
      rxCatchError(err => {
        // 409 = ya estaba guardado — tratar como éxito
        if (err?.status === 409) { this.savedChanged$.next(); return of({ message: 'OK' }); }
        // Si falla el backend, revertir el caché local
        this.writeSavedIds(this.readSavedIds().filter(id => id !== productId));
        throw err;
      })
    );
  }

  /**
   * Elimina un producto de la wishlist del backend.
   * También actualiza el caché local inmediatamente.
   */
  unsaveProduct(productId: string): Observable<{ message: string }> {
    this.writeSavedIds(this.readSavedIds().filter(id => id !== productId));
    return this.http.delete<void>(
      `${this.httpConfig.getApiUrl()}/wishlist/product/${encodeURIComponent(productId)}`
    ).pipe(
      map(() => { this.savedChanged$.next(); return { message: 'OK' }; }),
      rxCatchError(err => {
        // 400 = no estaba en wishlist — tratar como éxito
        if (err?.status === 400) { this.savedChanged$.next(); return of({ message: 'OK' }); }
        // Si falla el backend, restaurar el caché local
        const ids = this.readSavedIds();
        if (!ids.includes(productId)) this.writeSavedIds([...ids, productId]);
        throw err;
      })
    );
  }

  /**
   * Sincroniza el caché local de IDs guardados desde el backend.
   * Llamar en ngOnInit de componentes que muestren el estado de guardado.
   */
  syncSavedIds(): Observable<string[]> {
    return this.http.get<{ id: string; productId: string }[]>(
      `${this.httpConfig.getApiUrl()}/wishlist`
    ).pipe(
      map(items => {
        const ids = items.map(item => item.productId);
        this.writeSavedIds(ids);
        return ids;
      }),
      rxCatchError(() => of(this.readSavedIds()))
    );
  }

  private readSavedIds(): string[] {
    try { return JSON.parse(localStorage.getItem(this.SAVED_KEY + this.getCurrentUserId()) ?? '[]'); }
    catch { return []; }
  }

  private writeSavedIds(ids: string[]): void {
    localStorage.setItem(this.SAVED_KEY + this.getCurrentUserId(), JSON.stringify(ids));
  }

  // ── Refs tracking ─────────────────────────────────────────────────────────

  private trackRef(ref: string): void {
    if (!ref?.trim()) return;
    const key  = this.SEARCHED_KEY + this.getCurrentUserId();
    const list = [ref, ...(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]).filter(r => r !== ref)].slice(0, 60);
    localStorage.setItem(key, JSON.stringify(list));
  }

  private searchedRefs(): string[] {
    try { return JSON.parse(localStorage.getItem(this.SEARCHED_KEY + this.getCurrentUserId()) ?? '[]'); }
    catch { return []; }
  }

  // ── Product cache ─────────────────────────────────────────────────────────

  cacheProductName(productId: string, name: string): void {
    try {
      const key   = 'product_names_cache';
      const cache = JSON.parse(localStorage.getItem(key) ?? '{}');
      cache[productId] = name;
      const entries = Object.entries(cache);
      localStorage.setItem(key, JSON.stringify(
        entries.length > 200 ? Object.fromEntries(entries.slice(-200)) : cache
      ));
    } catch { /* ignore */ }
  }

  getCachedName(productId: string): string | null {
    try {
      return JSON.parse(localStorage.getItem('product_names_cache') ?? '{}')[productId] ?? null;
    } catch { return null; }
  }

  cacheFullProduct(product: Product): void {
    if (!product?.id) return;
    try {
      const key   = 'product_full_cache';
      const cache = JSON.parse(localStorage.getItem(key) ?? '{}');
      cache[product.id] = product;
      const entries = Object.entries(cache);
      localStorage.setItem(key, JSON.stringify(
        entries.length > 100 ? Object.fromEntries(entries.slice(-100)) : cache
      ));
      if (product.name) this.cacheProductName(product.id, product.name);
    } catch { /* ignore */ }
  }

  getCachedProduct(productId: string): Product | null {
    try {
      return JSON.parse(localStorage.getItem('product_full_cache') ?? '{}')[productId] ?? null;
    } catch { return null; }
  }

  private shortId(id: string): string {
    return id.slice(0, 8) + '…';
  }

  // ── Get product by ID ─────────────────────────────────────────────────────

  /**
   * Obtiene los productos más buscados.
   * Endpoint: GET /api/products/trending
   */
  getTrendingProducts(): Observable<Product[]> {
    return this.http.get<any[]>(
      `${this.httpConfig.getApiBaseUrl()}/products/trending`
    ).pipe(
      map(response => (response ?? []).map(r => this.mapBackendProduct(r))),
      rxCatchError(() => of([]))
    );
  }

  /**
   * GET /api/products/{id}/product
   * Endpoint corregido por el backend. Devuelve id, product_ref, source_name,
   * canonical_name, price, currency, category, availability, source_url, image_url.
   */
  getProduct(productId: string): Observable<Product> {
    return this.http.get<any>(
      `${this.httpConfig.getApiBaseUrl()}/products/${encodeURIComponent(productId)}/product`
    ).pipe(
      map(r => {
        const product = this.mapBackendProduct(r);
        if (product.id) this.cacheFullProduct(product);
        return product;
      })
    );
  }

  /**
   * Resuelve el nombre de un producto dado su ID.
   * Usa GET /api/products/{id}/product y guarda en caché.
   */
  resolveProductName(productId: string): Observable<string> {
    const cached = this.getCachedName(productId);
    if (cached) return of(cached);

    return this.http.get<any>(
      `${this.httpConfig.getApiBaseUrl()}/products/${encodeURIComponent(productId)}/product`
    ).pipe(
      map((raw: any) => {
        const name = raw?.canonical_name ?? raw?.canonicalName ?? raw?.name ?? '';
        if (name) {
          this.cacheProductName(productId, name);
          this.cacheFullProduct(this.mapBackendProduct(raw));
        }
        return name || this.shortId(productId);
      }),
      rxCatchError(() => of(this.shortId(productId)))
    );
  }

  /**
   * Busca por productRef + filtra por productId. Devuelve { best, all } | null.
   * Nota: POST /api/products/search filtra updatedAt >= now-20min.
   */
  /**
   * Busca un producto por ID y ref.
   * Intenta POST /search primero (solo productos recientes, < 20min).
   * Si no hay resultados, usa GET /products/{id}/product como fallback
   * (sin filtro de tiempo, siempre devuelve si existe en BD).
   */
  getProductByIdAndRef(productId: string, productRef: string): Observable<{ best: Product; all: Product[] } | null> {
    return this.getSearchFromDb(productRef).pipe(
      switchMap(resp => {
        if (resp.products.length > 0) {
          const best = resp.products.find(p => p.id === productId) ?? resp.products[0];
          return of({ best, all: resp.products });
        }
        // Fallback: producto existe pero tiene más de 20 min → endpoint sin filtro de tiempo
        return this.getProduct(productId).pipe(
          map(product => ({ best: product, all: [product] })),
          rxCatchError(() => of(null))
        );
      }),
      rxCatchError(() =>
        this.getProduct(productId).pipe(
          map(product => ({ best: product, all: [product] })),
          rxCatchError(() => of(null))
        )
      )
    );
  }

  // ── Search ────────────────────────────────────────────────────────────────

  /**
   * POST /api/products/search { product_ref }
   * Solo devuelve productos con updatedAt >= now-20min.
   */
  getSearchFromDb(productRef: string): Observable<ProductSearchResponse> {
    const ref = String(productRef ?? '').trim();
    if (!ref) return of({ productRef: '', products: [], totalResults: 0 });

    return this.http.post<any[]>(
      `${this.httpConfig.getApiBaseUrl()}/products/search`,
      { product_ref: ref }
    ).pipe(
      map(response => {
        const products = (response ?? []).map(r => this.mapBackendProduct(r));
        products.sort((a, b) => a.currentPrice - b.currentPrice);
        if (products.length) this.trackRef(ref);
        return { productRef: ref, products, totalResults: products.length };
      })
    );
  }

  /**
   * Búsqueda en tiempo real via WebSocket, con fallback a BD.
   */
  searchProducts(query: string): Observable<ProductSearchResponse> {
    const ref = query.trim().replace(/\s+/g, '').toLowerCase();
    if (!ref) return of({ productRef: '', products: [], totalResults: 0 });

    return this.getSearchFromDb(ref).pipe(
      switchMap(dbResp => {
        if (dbResp.products.length > 0) return of(dbResp);
        if (!this.stompService.isConnectedNow()) return of({ productRef: ref, products: [], totalResults: 0 });

        this.stompService.sendSearchCommand(query, ref);
        return this.stompService.products$.pipe(
          map((msg: any) => {
            const msgRef = String(msg?.productRef ?? msg?.product_ref ?? '').trim();
            if (msgRef && msgRef !== ref) return null;
            const products = (msg?.products ?? []).map((p: any) => this.mapBackendProduct(p));
            products.sort((a: Product, b: Product) => a.currentPrice - b.currentPrice);
            return { productRef: msgRef || ref, products, totalResults: msg?.totalResults || products.length } as ProductSearchResponse;
          }),
          filter((v): v is ProductSearchResponse => v !== null),
          timeout(30000),
          take(1),
          rxCatchError(() => of({ productRef: ref, products: [], totalResults: 0 })),
          map(resp => { if (resp.products.length) this.trackRef(resp.productRef || ref); return resp; })
        );
      })
    );
  }

  // ── Saved products list ───────────────────────────────────────────────────

  /**
   * Obtiene los productos guardados del usuario desde el backend.
   * GET /api/v1/wishlist → lista de WishlistItemDTO → resuelve cada productId a Product.
   */
  getSavedProducts(userId: string, page = 0, pageSize = 10): Observable<ProductSearchResponse> {
    return this.http.get<{ id: string; productId: string }[]>(
      `${this.httpConfig.getApiUrl()}/wishlist`
    ).pipe(
      switchMap(items => {
        if (!items.length) return of({ productRef: '', products: [], totalResults: 0 });
        const ids = items.map(item => item.productId);
        // Actualizar caché local con la lista real del backend
        this.writeSavedIds(ids);
        // Resolver cada productId a un Product completo
        return forkJoin(
          ids.map(id => this.getProduct(id).pipe(
            map(p => { p.isSaved = true; return p; }),
            rxCatchError(() => of(null as Product | null))
          ))
        ).pipe(
          map(results => {
            const valid = results.filter((p): p is Product => p !== null);
            return {
              productRef: '',
              products:   valid.slice(page * pageSize, (page + 1) * pageSize),
              totalResults: valid.length
            };
          })
        );
      }),
      rxCatchError(() => of({ productRef: '', products: [], totalResults: 0 }))
    );
  }

  // ── Outlier filter ────────────────────────────────────────────────────────

  private removeOutliers(products: Product[]): Product[] {
    if (products.length < 4) return products;
    const prices = products.map(p => p.currentPrice).filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
    if (prices.length < 4) return products;
    const mid    = Math.floor(prices.length / 2);
    const median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
    if (!median) return products;
    return products.filter(p => p.currentPrice >= median * 0.05 && p.currentPrice <= median * 20);
  }

  getPriceComparison(productId: string): Observable<any> {
    return this.httpConfig.get<any>(`/products/${productId}/priceComparison`);
  }
}