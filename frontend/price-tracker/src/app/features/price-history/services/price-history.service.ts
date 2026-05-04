import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
   * @param range - Rango de tiempo (W1, W3, W12, ALL)
   */
  getPriceHistory(productId: string, range: PriceHistoryRange = 'W3'): Observable<PriceHistoryResponse> {
    const endpointWithRange = `/products/${productId}/priceHistory?range=${range}`;

    return this.httpConfig.get<PriceHistoryResponse>(endpointWithRange).pipe(
      // Si el backend devuelve 400 por binding de enum u otro problema,
      // reintentar sin el query param `range` para ser tolerantes.
      catchError((err: any) => {
        if (err?.status === 400) {
          // Hacer un fetch crudo para capturar el body y headers del 400 para diagnóstico
          try {
            const debugUrl = `${this.httpConfig.getApiUrl()}/products/${productId}/priceHistory?range=${range}`;
            // not awaiting - fire-and-log
            fetch(debugUrl, { method: 'GET', credentials: 'include' })
              .then(async (resp) => {
                const text = await resp.text();
                console.warn('[PriceHistoryService][debugFetch] 400 body:', { status: resp.status, statusText: resp.statusText, body: text });
              })
              .catch((fetchErr) => console.warn('[PriceHistoryService][debugFetch] fetch error:', fetchErr));
          } catch (e) {
            console.warn('[PriceHistoryService][debugFetch] unexpected error:', e);
          }

          return this.httpConfig.get<PriceHistoryResponse>(`/products/${productId}/priceHistory`);
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Obtiene análisis de tendencia de precios
   */
  getTrendAnalysis(productId: string): Observable<PriceTrendAnalysis> {
    return this.getPriceHistory(productId, 'W3').pipe(
      map((response) => {
        const points = [...response.history].sort((a, b) => Number(new Date(a.updatedAt)) - Number(new Date(b.updatedAt)));
        const prices = points.map((point) => Number(point.price || 0)).filter((value) => Number.isFinite(value) && value > 0);

        if (!prices.length) {
          return {
            productId,
            currentPrice: 0,
            minPrice: 0,
            maxPrice: 0,
            averagePrice: 0,
            trend: 'stable',
            percentageChange: 0,
            recommendation: 'Sin datos suficientes para analizar tendencia'
          };
        }

        const first = prices[0];
        const last = prices[prices.length - 1];
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const percentageChange = first > 0 ? ((last - first) / first) * 100 : 0;
        const trend: PriceTrendAnalysis['trend'] = percentageChange > 1 ? 'up' : percentageChange < -1 ? 'down' : 'stable';

        return {
          productId,
          currentPrice: last,
          minPrice,
          maxPrice,
          averagePrice,
          trend,
          percentageChange,
          recommendation: trend === 'down' ? 'Precio en descenso: buen momento para comprar' : trend === 'up' ? 'Precio al alza: conviene activar alertas' : 'Precio estable'
        };
      })
    );
  }

  /**
   * Obtiene el historial de precios para múltiples productos
   */
  getMultipleProductHistory(productIds: string[], range: PriceHistoryRange = 'W3'): Observable<PriceHistoryResponse[]> {
    if (!productIds.length) {
      return of([]);
    }

    return forkJoin(productIds.map((productId) => this.getPriceHistory(productId, range)));
  }
}
