import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, Subject } from 'rxjs';
import { map, switchMap, timeout, take, catchError as rxCatchError } from 'rxjs/operators';
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
   * Busca productos por query usando STOMP cuando está disponible, REST como fallback
   */
  searchProducts(query: string): Observable<ProductSearchResponse> {
    const productRef = query.trim().replace(/\s+/g, '');

    // Si STOMP está conectado, usar WebSocket
    if (this.stompService.isConnectedNow()) {
      console.log('📡 Usando STOMP para búsqueda');
      
      // Enviar comando de búsqueda por STOMP
      this.stompService.sendSearchCommand(query, productRef);

      // Escuchar respuesta del backend (con timeout de 30 segundos)
      return this.stompService.products$.pipe(
        timeout(30000),
        take(1),
        map((message: any) => {
          const products = (message.products ?? []).map((item: any) => this.mapBackendProduct(item));
          return {
            productRef: message.productRef || productRef,
            products,
            totalResults: message.totalResults || products.length
          };
        }),
        rxCatchError((error) => {
          console.warn('⚠️ STOMP timeout o error, usando REST fallback:', error);
          return this.searchProductsRest(query, productRef);
        })
      );
    } else {
      // Si STOMP no está conectado, usar REST
      console.log('🔗 Usando REST para búsqueda (STOMP desconectado)');
      return this.searchProductsRest(query, productRef);
    }
  }

  /**
   * Búsqueda por REST (fallback)
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
