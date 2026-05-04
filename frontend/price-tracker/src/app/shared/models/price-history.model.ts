/**
 * Price History Model - Registro histórico de precios
 */
export interface PriceHistoryPoint {
  updatedAt: Date | string;
  price: number;
  currency: string;
  source?: string;
  sourceName?: string;
}

export interface PriceHistory {
  productId: string;
  category: PriceHistoryRange;
  history: PriceHistoryPoint[];
}

/**
 * Respuesta del historial de precios desde el backend
 */
export interface PriceHistoryResponse extends PriceHistory {}

/**
 * Análisis de tendencia de precios
 */
export interface PriceTrendAnalysis {
  productId: string;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  averagePrice: number;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
  recommendation: string;
}

/**
 * Filtro para obtener historial de precios
 */
export type PriceHistoryRange = 'W1' | 'W3' | 'W12' | 'ALL';

export interface PriceHistoryFilter {
  range: PriceHistoryRange;
  currency?: string;
}
