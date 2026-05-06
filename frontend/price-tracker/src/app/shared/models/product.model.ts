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
  url?: string;          // source_url del backend — link directo a la tienda
  bestPrice?: number;
  savings?: number;
  savingsPercent?: number;
  isSaved?: boolean;
}

export interface ProductSearchRequest {
  product_ref: string;
}

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

export interface ProductSearchResponse {
  productRef: string;
  products: Product[];
  totalResults: number;
}