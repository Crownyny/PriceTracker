/**
 * Price History Model - Registro histórico de precios
 */
export interface PriceHistoryPoint {
  date: Date;
  price: number;
  currency: string;
  availability: boolean;
  source: string;
}

/**
 * Respuesta del historial de precios desde el backend
 */
export interface PriceHistoryResponse {
  productRef: string;
  productId: string;
  history: PriceHistoryPoint[];
}

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
export type PriceHistoryRange = 'W1' | 'W2' | 'M1' | 'M3' | 'M6' | 'Y1' | 'ALL';

export interface PriceHistoryFilter {
  range: PriceHistoryRange;
  currency?: string;
}
