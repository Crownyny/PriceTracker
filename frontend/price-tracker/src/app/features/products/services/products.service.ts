import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, Subject } from 'rxjs';
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

  constructor(
    private http: HttpClient,
    private httpConfig: HttpConfigService,
    private stompService: StompWebSocketService
  ) {}

  private mapBackendProduct(raw: any): Product {
    return {
      id: raw.id,
      productRef: raw.product_ref ?? raw.productRef ?? '',
      name: raw.canonical_name ?? raw.name ?? '',
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
    const productRef = query.trim().replace(/\s+/g, '');

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
          rxCatchError(() => of({ productRef, products: [], totalResults: 0 }))
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
    const ref = String(productRef || '').trim();
    if (!ref) {
      return of({ productRef: '', products: [], totalResults: 0 });
    }

    return this.http.post<any[]>(`${this.httpConfig.getApiBaseUrl()}/products/search`, { product_ref: ref }).pipe(
      map((response) => {
        const products = (response ?? []).map((item) => this.mapBackendProduct(item));
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
    return this.httpConfig.get<Product>(`/products/${productId}`);
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
    const products = this.readSavedProducts(userId);
    const start = page * pageSize;
    const paged = products.slice(start, start + pageSize);

    return of({
      productRef: '',
      products: paged,
      totalResults: products.length
    });
  }

  /**
   * Guarda un producto
   */
  saveProduct(productId: string): Observable<{ message: string }> {
    return this.httpConfig.post<{ message: string }>(
      `/products/${productId}/save`,
      {}
    );
  }

  /**
   * Elimina un producto guardado
   */
  unsaveProduct(productId: string): Observable<{ message: string }> {
    return this.httpConfig.delete<{ message: string }>(
      `/products/${productId}/save`
    );
  }

  /**
   * Obtiene comparación de precios para un producto
   */
  getPriceComparison(productId: string): Observable<any> {
    return this.httpConfig.get<any>(
      `/products/${productId}/priceComparison`
    );
  }
}
