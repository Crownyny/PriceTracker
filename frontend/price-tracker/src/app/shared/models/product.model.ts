/**
 * Product Model - Representa un producto en el sistema
 */
export interface Product {
  id: string;
  productRef: string;
  name: string;
  ean?: string;
  category?: string;
  image?: string;
  description?: string;
  currentPrice: number;
  currency: string;
  availability: boolean;
  source?: string;
}

/**
 * Product Source - Para comparación entre tiendas
 */
export interface ProductSource {
  sourceId: string;
  sourceName: string;
  price: number;
  currency: string;
  shippingCost?: number;
  availability: boolean;
  url: string;
  lastUpdated?: Date;
}

/**
 * Respuesta de búsqueda de productos
 */
export interface ProductSearchResponse {
  productRef: string;
  products: Product[];
  totalResults: number;
}
