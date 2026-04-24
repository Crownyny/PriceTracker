import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpConfigService } from '../../../core/services/http-config.service';
import { Product, ProductSearchResponse } from '../../../shared/models/product.model';

/**
 * Products Service - Gestiona productos y búsqueda
 */
@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  constructor(
    private httpConfig: HttpConfigService
  ) {}

  /**
   * Busca productos por query (REST fallback)
   */
  searchProducts(query: string): Observable<ProductSearchResponse> {
    return this.httpConfig.get<ProductSearchResponse>(
      `/products/search?q=${encodeURIComponent(query)}`
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
    return this.httpConfig.get<ProductSearchResponse>(
      `/users/${userId}/saved-products?page=${page}&pageSize=${pageSize}`
    );
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
