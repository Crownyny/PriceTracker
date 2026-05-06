import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { filter, map, switchMap, timeout, take, catchError as rxCatchError } from 'rxjs/operators';
import { HttpConfigService } from '../../../core/services/http-config.service';
import { StompWebSocketService } from '../../../core/services/stomp-websocket.service';
import { Product, ProductSearchResponse } from '../../../shared/models/product.model';

/**
 * Products Service - Gestiona productos y búsqueda
 * 
 * Usa STOMP WebSocket como mecanismo principal cuando está conectado,
 * con fallback a REST HTTP si la conexión no está disponible.
 */
@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private readonly SAVED_PRODUCTS_KEY_PREFIX = 'saved_products_';
  private readonly SEARCHED_REFS_KEY_PREFIX = 'searched_product_refs_';

  constructor(
    private http: HttpClient,
    private httpConfig: HttpConfigService,
    private stompService: StompWebSocketService
  ) {}

  private mapBackendProduct(raw: any): Product {
    return {
      id: String(raw.id ?? raw.product_id ?? raw.productId ?? ''),
      productRef: raw.product_ref ?? raw.productRef ?? '',
      name: raw.canonical_name ?? raw.canonicalName ?? raw.name ?? '',
      category: raw.category,
      image: raw.image_url ?? raw.image,
      description: raw.description,
      currentPrice: Number(raw.price ?? raw.currentPrice ?? 0),
      currency: raw.currency ?? 'USD',
      availability: Boolean(raw.availability),
      source: raw.source_name ?? raw.source,
      // Agregar propiedades de comparación si existen
      bestPrice: raw.best_price ?? raw.bestPrice,
      savings: raw.savings,
      savingsPercent: raw.savings_percent ?? raw.savingsPercent
    };
  }

  private getSearchedRefsKey(userId: string): string {
    return `${this.SEARCHED_REFS_KEY_PREFIX}${userId}`;
  }

  private readSearchedRefs(userId: string): string[] {
    const raw = localStorage.getItem(this.getSearchedRefsKey(userId));
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((item) => typeof item === 'string' && item.trim().length > 0);
    } catch {
      return [];
    }
  }

  private trackProductRef(userId: string, productRef: string): void {
    const ref = String(productRef || '').trim();
    if (!ref) {
      return;
    }

    const current = this.readSearchedRefs(userId).filter((item) => item !== ref);
    const next = [ref, ...current].slice(0, 60);
    localStorage.setItem(this.getSearchedRefsKey(userId), JSON.stringify(next));
  }

  private getCurrentUserId(): string {
    const raw = localStorage.getItem('user_profile');
    if (raw) {
      try {
        const profile = JSON.parse(raw) as { id?: string };
        if (profile?.id) {
          return profile.id;
        }
      } catch {
        // no-op
      }
    }

    return localStorage.getItem('userId') || 'default-user';
  }

  private getSavedProductsKey(userId: string): string {
    return `${this.SAVED_PRODUCTS_KEY_PREFIX}${userId}`;
  }

  private readSavedProducts(userId: string): Product[] {
    const raw = localStorage.getItem(this.getSavedProductsKey(userId));
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeSavedProducts(userId: string, products: Product[]): void {
    localStorage.setItem(this.getSavedProductsKey(userId), JSON.stringify(products));
  }

  /**
   * Busca productos.
   *
   * Regla (Postman / requerimiento): **REST primero** para resultados en BD por `product_ref`.
   * Si no hay resultados, usar WebSocket STOMP para obtener productos en tiempo real.
   */
  searchProducts(query: string): Observable<ProductSearchResponse> {
    const productRef = query.trim().replace(/\s+/g, '').toLowerCase();

    if (!productRef) {
      return of({
        productRef: '',
        products: [],
        totalResults: 0
      });
    }

    return this.getSearchFromDb(productRef).pipe(
      switchMap((dbResponse) => {
        if ((dbResponse.products ?? []).length > 0) {
          this.trackProductRef(this.getCurrentUserId(), productRef);
          return of(dbResponse);
        }

        if (!this.stompService.isConnectedNow()) {
          // Sin WS y sin resultados en BD => devolver vacío.
          return of({ productRef, products: [], totalResults: 0 });
        }

        // WS: enviar y esperar el primer mensaje de productos para este `productRef`
        this.stompService.sendSearchCommand(query, productRef);

        return this.stompService.products$.pipe(
          map((message: any) => {
            const msgRef = String(message?.productRef ?? message?.product_ref ?? '').trim();
            if (msgRef && msgRef !== productRef) {
              return null;
            }

            const products = (message?.products ?? []).map((item: any) => this.mapBackendProduct(item));
            return {
              productRef: msgRef || productRef,
              products,
              totalResults: message?.totalResults || products.length
            } as ProductSearchResponse;
          }),
          // Ignorar mensajes de otras búsquedas
          filter((value): value is ProductSearchResponse => Boolean(value)),
          timeout(30000),
          take(1),
          rxCatchError(() => of({ productRef, products: [], totalResults: 0 })),
          map((response) => {
            if ((response.products ?? []).length > 0) {
              this.trackProductRef(this.getCurrentUserId(), response.productRef || productRef);
            }
            return response;
          })
        );
      })
    );
  }

  /**
   * @deprecated No usar para iniciar scraping. Se deja por compatibilidad si hay pantallas antiguas.
   * TODO(frontend): confirmar con backend si existe endpoint REST para disparar scraping (no inventar).
   */
  private searchProductsRest(query: string, productRef: string): Observable<ProductSearchResponse> {
    const payload = {
      query,
      search_id: productRef,
      product_ref: productRef
    };

    return this.http.post<any[]>(`${this.httpConfig.getApiBaseUrl()}/products/search`, payload).pipe(
      map((response) => {
        const products = (response ?? []).map((item) => this.mapBackendProduct(item));
        return {
          productRef,
          products,
          totalResults: products.length
        };
      })
    );
  }

  /**
   * Obtiene resultados ya guardados en BD por product_ref (sin disparar scraping nuevo).
   * Endpoint (Postman): POST /api/products/search { product_ref }
   */
  getSearchFromDb(productRef: string): Observable<ProductSearchResponse> {
    const ref = String(productRef || '').trim().toLowerCase();
    if (!ref) {
      return of({ productRef: '', products: [], totalResults: 0 });
    }

    return this.http.post<any[]>(`${this.httpConfig.getApiBaseUrl()}/products/search`, { product_ref: ref }).pipe(
      map((response) => {
        const products = (response ?? []).map((item) => this.mapBackendProduct(item));
        if (products.length > 0) {
          this.trackProductRef(this.getCurrentUserId(), ref);
        }
        return {
          productRef: ref,
          products,
          totalResults: products.length
        };
      })
    );
  }

  /**
   * Obtiene un producto por ID
   */
  getProduct(productId: string): Observable<Product> {
    return this.httpConfig.get<Product>(`/products/${productId}/product`);
  }

  /**
   * Obtiene un producto por referencia (productRef)
   */
  getProductByRef(productRef: string): Observable<Product> {
    return this.httpConfig.get<Product>(`/products/ref/${productRef}`);
  }

  /**
   * Obtiene productos guardados del usuario
   */
  getSavedProducts(userId: string, page: number = 0, pageSize: number = 10): Observable<ProductSearchResponse> {
    const refs = this.readSearchedRefs(userId);
    if (!refs.length) {
      return of({
        productRef: '',
        products: [],
        totalResults: 0
      });
    }

    const requests = refs.map((ref) => this.getSearchFromDb(ref).pipe(
      rxCatchError(() => of({ productRef: ref, products: [], totalResults: 0 }))
    ));

    return forkJoin(requests).pipe(
      map((responses) => {
        const merged = responses
          .flatMap((response) => response.products)
          .filter((product) => Boolean(product?.id));

        const uniqueById = Array.from(new Map(merged.map((product) => [product.id, product])).values());
        const start = page * pageSize;
        const paged = uniqueById.slice(start, start + pageSize);

        return {
          productRef: '',
          products: paged,
          totalResults: uniqueById.length
        };
      })
    );
  }

  /**
   * Guarda un producto (localStorage — el endpoint /save no existe en el backend aún)
   */
  saveProduct(productId: string): Observable<{ message: string }> {
    const userId = this.getCurrentUserId();
    const saved = this.readSavedProducts(userId);
    const alreadySaved = saved.some((p) => p.id === productId);
    if (!alreadySaved) {
      // Guardamos solo el id; el objeto completo se recupera por búsqueda
      this.writeSavedProducts(userId, [...saved, { id: productId } as Product]);
    }
    return of({ message: 'OK' });
  }

  /**
   * Elimina un producto guardado (localStorage)
   */
  unsaveProduct(productId: string): Observable<{ message: string }> {
    const userId = this.getCurrentUserId();
    this.writeSavedProducts(
      userId,
      this.readSavedProducts(userId).filter((p) => p.id !== productId)
    );
    return of({ message: 'OK' });
  }

  /**
   * Comprueba si un producto está guardado por el usuario actual
   */
  isProductSaved(productId: string): boolean {
    const userId = this.getCurrentUserId();
    return this.readSavedProducts(userId).some((p) => p.id === productId);
  }

  /**
   * Obtiene un producto buscando por productRef y filtrando por productId.
   * Más robusto que getProduct() cuando el endpoint GET /products/{id}/product
   * devuelve 500 por un bug en el backend.
   */
  getProductByIdAndRef(productId: string, productRef: string): Observable<{ best: Product; all: Product[] } | null> {
    return this.getSearchFromDb(productRef).pipe(
      map(resp => {
        if (!resp.products.length) return null;
        const best = resp.products[0]; // ya ordenado por precio asc
        return { best, all: resp.products };
      }),
      rxCatchError(() => of(null))
    );
  }

  /**
   * Obtiene comparación de precios para un producto
   */
  getPriceComparison(productId: string): Observable<any> {
    return this.httpConfig.get<any>(`/products/${productId}/priceComparison`);
  }

  /**
   * Resuelve el nombre legible de un producto dado su ID.
   * Intenta GET /api/v1/products/{id}/product, luego caché, luego ID truncado.
   */
  /**
   * Resuelve el nombre de un producto dado su ID.
   * Estrategia en cascada (sin ruido en consola):
   *   1. Caché localStorage (instantáneo)
   *   2. POST /api/products/search { product_ref: productId } (el ID a veces es indexable)
   *   3. ID truncado como último recurso
   *
   * Para poblar el caché automáticamente: visitar el detalle del producto
   * o crear una alerta desde el detalle (ambos llaman cacheProductName).
   */
  resolveProductName(productId: string): Observable<string> {
    const cached = this.getCachedName(productId);
    if (cached) return of(cached);

    return this.http.post<any[]>(
      `${this.httpConfig.getApiBaseUrl()}/products/search`,
      { product_ref: productId }
    ).pipe(
      map((response: any[]) => {
        const items = response ?? [];
        // Buscar el item que corresponde exactamente a este ID
        const match = items.find((r: any) => r.id === productId) ?? items[0];
        const name = match?.canonical_name ?? match?.canonicalName ?? match?.name ?? '';
        if (name) this.cacheProductName(productId, name);
        return name || this.shortId(productId);
      }),
      rxCatchError(() => of(this.shortId(productId)))
    );
  }

  cacheProductName(productId: string, name: string): void {
    try {
      const key = 'product_names_cache';
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

  /** Guarda el objeto Product completo en caché para uso en historial/alertas */
  cacheFullProduct(product: Product): void {
    if (!product?.id) return;
    try {
      const key = 'product_full_cache';
      const cache = JSON.parse(localStorage.getItem(key) ?? '{}');
      cache[product.id] = product;
      const entries = Object.entries(cache);
      localStorage.setItem(key,
        JSON.stringify(entries.length > 100 ? Object.fromEntries(entries.slice(-100)) : cache)
      );
      // También guardar el nombre en el caché de nombres
      if (product.name) this.cacheProductName(product.id, product.name);
    } catch { /* ignore */ }
  }

  /** Recupera el objeto Product completo desde caché */
  getCachedProduct(productId: string): Product | null {
    try {
      return JSON.parse(localStorage.getItem('product_full_cache') ?? '{}')[productId] ?? null;
    } catch { return null; }
  }

  private shortId(id: string): string {
    return id.slice(0, 8) + '…';
  }
}