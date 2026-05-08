import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { filter, map, switchMap, timeout, take, catchError as rxCatchError } from 'rxjs/operators';
import { HttpConfigService } from '../../../core/services/http-config.service';
import { StompWebSocketService } from '../../../core/services/stomp-websocket.service';
import { Product, ProductSearchResponse } from '../../../shared/models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly SAVED_KEY    = 'saved_product_ids_';
  private readonly SEARCHED_KEY = 'searched_product_refs_';

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

  // ── Saved products (localStorage) ─────────────────────────────────────────

  isProductSaved(productId: string): boolean {
    return this.readSavedIds().includes(productId);
  }

  saveProduct(productId: string): Observable<{ message: string }> {
    const ids = this.readSavedIds();
    if (!ids.includes(productId)) this.writeSavedIds([...ids, productId]);
    return of({ message: 'OK' });
  }

  unsaveProduct(productId: string): Observable<{ message: string }> {
    this.writeSavedIds(this.readSavedIds().filter(id => id !== productId));
    return of({ message: 'OK' });
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
  getProductByIdAndRef(productId: string, productRef: string): Observable<{ best: Product; all: Product[] } | null> {
    return this.getSearchFromDb(productRef).pipe(
      map(resp => {
        if (!resp.products.length) return null;
        const best = resp.products[0];
        return { best, all: resp.products };
      }),
      rxCatchError(() => of(null))
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

  getSavedProducts(userId: string, page = 0, pageSize = 10): Observable<ProductSearchResponse> {
    const refs = this.searchedRefs();
    if (!refs.length) return of({ productRef: '', products: [], totalResults: 0 });

    return forkJoin(
      refs.map(ref => this.getSearchFromDb(ref).pipe(rxCatchError(() => of({ productRef: ref, products: [], totalResults: 0 }))))
    ).pipe(
      map(responses => {
        const savedIds = new Set(this.readSavedIds());
        const all      = responses.flatMap(r => r.products).filter(p => p?.id);
        const unique   = Array.from(new Map(all.map(p => [p.id, p])).values());
        unique.forEach((p: any) => { p.isSaved = savedIds.has(p.id); });
        return {
          productRef: '',
          products: unique.slice(page * pageSize, (page + 1) * pageSize),
          totalResults: unique.length
        };
      })
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