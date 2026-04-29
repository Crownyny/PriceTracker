import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductsService } from '../products/services/products.service';
import { TokenService } from '../../core/services/token.service';
import { Product } from '../../shared/models/product.model';
import { PriceHistoryService } from '../price-history/services/price-history.service';
import { PriceTrendAnalysis } from '../../shared/models/price-history.model';
import { catchError, finalize, forkJoin, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  loading = false;
  error = '';
  totalSavings = 0;
  itemsCompared = 0;
  savedProducts: Product[] = [];
  alertCount = 0;
  bestDeals: Product[] = [];
  comparativeRows: Array<{ product: Product; trend: PriceTrendAnalysis['trend'] | null; percentageChange: number | null }> = [];

  constructor(
    private productsService: ProductsService,
    private priceHistoryService: PriceHistoryService,
    private tokenService: TokenService
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.loading = true;
    this.error = '';

    const userId = this.getCurrentUserId();

    this.productsService.getSavedProducts(userId, 0, 50).pipe(
      switchMap((saved) => {
        this.savedProducts = saved.products ?? [];
        this.itemsCompared = saved.totalResults ?? this.savedProducts.length;

        // Tabla comparativa: máximo 10 para no sobrecargar
        const comparativeProducts = this.savedProducts.slice(0, 10);
        const trends$ = comparativeProducts.length
          ? forkJoin(
              comparativeProducts.map((p) =>
                this.priceHistoryService.getTrendAnalysis(p.id).pipe(
                  catchError(() => of(null))
                )
              )
            )
          : of([] as Array<PriceTrendAnalysis | null>);

        return trends$.pipe(
          switchMap((trends) => {
            const trendByProductId = new Map<string, PriceTrendAnalysis>();
            for (const t of trends ?? []) {
              if (t?.productId) {
                trendByProductId.set(t.productId, t);
              }
            }

            this.comparativeRows = comparativeProducts.map((product) => {
              const trend = trendByProductId.get(product.id) ?? null;
              return {
                product,
                trend: trend?.trend ?? null,
                percentageChange: typeof trend?.percentageChange === 'number' ? trend.percentageChange : null
              };
            });

            this.bestDeals = this.buildBestDeals(this.savedProducts);
            this.totalSavings = this.computeTotalSavings(this.savedProducts);
            return of(null);
          })
        );
      }),
      catchError((err) => {
        console.error('Error cargando dashboard:', err);
        this.error = 'No fue posible cargar el dashboard.';
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe();
  }

  private getCurrentUserId(): string {
    const profile = this.tokenService.getUserProfile();
    return profile?.id || localStorage.getItem('userId') || 'default-user';
  }

  private computeTotalSavings(products: Product[]): number {
    const safeProducts = Array.isArray(products) ? products : [];
    return safeProducts.reduce((acc, p) => {
      const direct = Number(p.savings ?? 0);
      if (direct > 0) return acc + direct;
      const best = Number(p.bestPrice ?? 0);
      const current = Number(p.currentPrice ?? 0);
      if (best > 0 && current > 0 && current > best) return acc + (current - best);
      return acc;
    }, 0);
  }

  private buildBestDeals(products: Product[]): Product[] {
    const safe = Array.isArray(products) ? products : [];
    return [...safe]
      .map((p) => ({
        ...p,
        savingsPercent: this.ensureSavingsPercent(p)
      }))
      .sort((a, b) => Number(b.savingsPercent ?? 0) - Number(a.savingsPercent ?? 0))
      .slice(0, 8);
  }

  private ensureSavingsPercent(p: Product): number {
    if (typeof p.savingsPercent === 'number' && Number.isFinite(p.savingsPercent)) {
      return p.savingsPercent;
    }
    const current = Number(p.currentPrice ?? 0);
    const best = Number(p.bestPrice ?? 0);
    if (current > 0 && best > 0 && current > best) {
      return Math.round(((current - best) / current) * 100);
    }
    const savings = Number(p.savings ?? 0);
    if (current > 0 && savings > 0) {
      return Math.round((savings / current) * 100);
    }
    return 0;
  }
}
