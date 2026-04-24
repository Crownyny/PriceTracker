import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpConfigService } from '../../../core/services/http-config.service';
import {
  PriceHistoryResponse,
  PriceTrendAnalysis,
  PriceHistoryRange
} from '../../../shared/models/price-history.model';

/**
 * Price History Service - Gestiona el historial de precios
 * Endpoints:
 * - GET /api/v1/products/{productId}/priceHistory?range=W1
 */
@Injectable({
  providedIn: 'root'
})
export class PriceHistoryService {
  constructor(
    private httpConfig: HttpConfigService
  ) {}

  /**
   * Obtiene el historial de precios de un producto
   * @param productId - ID del producto
   * @param range - Rango de tiempo (W1, W2, M1, M3, M6, Y1, ALL)
   */
  getPriceHistory(productId: string, range: PriceHistoryRange = 'M1'): Observable<PriceHistoryResponse> {
    return this.httpConfig.get<PriceHistoryResponse>(
      `/products/${productId}/priceHistory?range=${range}`
    );
  }

  /**
   * Obtiene análisis de tendencia de precios
   */
  getTrendAnalysis(productId: string): Observable<PriceTrendAnalysis> {
    return this.httpConfig.get<PriceTrendAnalysis>(`/products/${productId}/priceTrend`);
  }

  /**
   * Obtiene el historial de precios para múltiples productos
   */
  getMultipleProductHistory(productIds: string[], range: PriceHistoryRange = 'M1'): Observable<PriceHistoryResponse[]> {
    const params = {
      productIds: productIds.join(','),
      range
    };

    return this.httpConfig.get<PriceHistoryResponse[]>(
      `/products/batch/priceHistory`,
      { params }
    );
  }
}
