import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductsService } from '../products/services/products.service';
import { TokenService } from '../../core/services/token.service';
import { Product } from '../../shared/models/product.model';
import { PriceHistoryService } from '../price-history/services/price-history.service';
import { PriceTrendAnalysis } from '../../shared/models/price-history.model';
import { catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { AlertService } from '../alerts/services/alert.service';
import { Alert, AlertFrequency } from '../../shared/models/alert.model';
import { getFrequencyLabel } from '../../shared/utils/alert.utils';
import { UserRoleService } from '../../core/services/user-role.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
  userRoleLabel = 'registered';
  bestDeals: Product[] = [];
  comparativeRows: Array<{ product: Product; trend: PriceTrendAnalysis['trend'] | null; percentageChange: number | null }> = [];
  storeFilter = '';

  get availableStores(): string[] {
    const fromDeals   = this.bestDeals.map(p => p.source);
    const fromTable   = this.comparativeRows.map(r => r.product.source);
    const all = [...fromDeals, ...fromTable].filter((s): s is string => Boolean(s));
    return [...new Set(all)].sort();
  }

  get filteredBestDeals(): Product[] {
    if (!this.storeFilter) return this.bestDeals;
    return this.bestDeals.filter(p => p.source === this.storeFilter);
  }

  get filteredComparativeRows() {
    if (!this.storeFilter) return this.comparativeRows;
    return this.comparativeRows.filter(r => r.product.source === this.storeFilter);
  }
  
  // Modal inline de alerta
  alertModalOpen = false;
  alertModalProduct: Product | null = null;
  alertModalExisting: Alert | null = null;
  alertModalFrequency: AlertFrequency = 'instant';
  alertModalSubmitting = false;
  alertModalError: string | null = null;
  alertModalSuccess: string | null = null;
  alertsByProductId: Record<string, Alert> = {};
  isPremium = false;

  constructor(
    private productsService: ProductsService,
    private priceHistoryService: PriceHistoryService,
    private tokenService: TokenService,
    private alertService: AlertService,
    private userRoleService: UserRoleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.loading = true;
    this.error = '';
    this.userRoleLabel = this.userRoleService.getCurrentRole();
    this.isPremium = this.userRoleService.canUsePremiumFeatures();
    this.userRoleService.fetchAndSyncRole().subscribe(role => {
      this.isPremium = role === 'premium';
      this.userRoleLabel = role;
      this.cdr.markForCheck();
    });

    // Reaccionar en tiempo real a cambios de rol (Mi Cuenta, Postman)
    this.tokenService.role$.subscribe(role => {
      this.isPremium = role === 'premium';
      this.userRoleLabel = role;
      this.cdr.markForCheck();
    });

    const userId = this.getCurrentUserId();

    // Cargar alertas y productos guardados en paralelo
    forkJoin({
      alerts:  this.alertService.getAlerts().pipe(
                 catchError(() => of({ alerts: [], total: 0, page: 0, pageSize: 0 }))
               ),
      saved:   this.productsService.getSavedProducts(userId, 0, 50).pipe(
                 catchError(() => of({ productRef: '', products: [], totalResults: 0 }))
               )
    }).pipe(
      switchMap(({ alerts: alertsResponse, saved }) => {
        const allAlerts = alertsResponse.alerts ?? [];
        this.alertCount = allAlerts.filter(a => Boolean(a.isActive)).length;

        this.alertsByProductId = {};
        for (const a of allAlerts) {
          if (a.productId) this.alertsByProductId[a.productId] = a;
        }

        const alertProductIds = [
          ...new Set(allAlerts.map(a => a.productId).filter(Boolean))
        ].slice(0, 20);

        const cachedProducts = saved.products ?? [];

        const alertProducts$ = alertProductIds.length
          ? forkJoin(
              alertProductIds.map(id =>
                this.productsService.getProduct(id).pipe(catchError(() => of(null)))
              )
            )
          : of([] as Array<Product | null>);

        return alertProducts$.pipe(
          switchMap((alertResults) => {
            const alertProducts = alertResults.filter(
              (p): p is Product => p !== null
            );

            const alertIds = new Set(alertProducts.map(p => p.id));
            const uniqueCached = cachedProducts.filter(p => !alertIds.has(p.id));
            const allProducts  = [...alertProducts, ...uniqueCached];

            this.savedProducts = allProducts;
            this.itemsCompared = allProducts.length;

            const forTable = allProducts.slice(0, 10);
            const trends$ = forTable.length
              ? forkJoin(
                  forTable.map(p =>
                    this.priceHistoryService.getTrendAnalysis(p.id).pipe(catchError(() => of(null)))
                  )
                )
              : of([] as Array<PriceTrendAnalysis | null>);

            return trends$.pipe(
              switchMap((trends) => {
                const trendMap = new Map<string, PriceTrendAnalysis>();
                for (const t of trends ?? []) {
                  if (t?.productId) trendMap.set(t.productId, t);
                }

                this.comparativeRows = forTable.map(product => ({
                  product,
                  trend: trendMap.get(product.id)?.trend ?? null,
                  percentageChange: trendMap.get(product.id)?.percentageChange ?? null
                }));
                this.storeFilter = '';

                this.bestDeals    = this.buildBestDeals(allProducts);
                this.totalSavings = this.computeTotalSavings(allProducts);

                return of(null);
              })
            );
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
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => this.cdr.markForCheck(),
      error: () => this.cdr.markForCheck()
    });
  }

  private getCurrentUserId(): string {
    const profile = this.tokenService.getUserProfile();
    return profile?.id || localStorage.getItem('userId') || 'default-user';
  }

  private computeTotalSavings(products: Product[]): number {
    return products.reduce((acc, p) => {
      const direct = Number(p.savings ?? 0);
      if (direct > 0) return acc + direct;
      const best = Number(p.bestPrice ?? 0);
      const current = Number(p.currentPrice ?? 0);
      if (best > 0 && current > 0 && current > best) return acc + (current - best);
      return acc;
    }, 0);
  }

  private buildBestDeals(products: Product[]): Product[] {
    return [...products]
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

  
  openAlertModal(product: Product): void {
    this.alertModalProduct = product;
    this.alertModalError = null;
    this.alertModalSuccess = null;
    this.alertModalSubmitting = false;

    const existing = this.alertsByProductId[product.id] ?? null;
    this.alertModalExisting = existing;
    this.alertModalFrequency = existing?.frequency ?? 'instant';
    this.alertModalOpen = true;
  }

  closeAlertModal(): void {
    this.alertModalOpen = false;
    this.alertModalProduct = null;
    this.alertModalExisting = null;
    this.alertModalError = null;
    this.alertModalSuccess = null;
  }

  submitCreateAlert(): void {
    if (!this.alertModalProduct) return;

    if (this.alertModalFrequency === 'weekly' && !this.isPremium) {
      this.alertModalError = 'La frecuencia semanal es una función Premium.';
      return;
    }

    this.alertModalSubmitting = true;
    this.alertModalError = null;

    this.alertService.createAlertWithoutDuplicate(this.alertModalProduct.id, {
      frequency: this.alertModalFrequency
    }).subscribe({
      next: (response) => {
        if (response.message === 'ALERT_ALREADY_EXISTS') {
          this.alertModalSuccess = 'Ya tenías una alerta para este producto.';
          if (response.alert) {
            this.alertsByProductId[this.alertModalProduct!.id] = response.alert;
            this.alertModalExisting = response.alert;
          }
        } else {
          this.alertModalSuccess = '¡Alerta creada exitosamente!';
          if (response.alert) {
            this.alertsByProductId[this.alertModalProduct!.id] = response.alert;
            this.alertModalExisting = response.alert;
            this.alertCount++;
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        if (err?.status === 409) {
          this.alertModalError = 'Ya existe una alerta para este producto.';
        } else if (
          err?.status === 403 ||
          (err?.status === 400 &&
            String(err?.error?.message ?? '').toLowerCase().includes('maximum'))
        ) {
          this.alertModalError = this.isPremium
            ? 'Límite de alertas alcanzado. Contacta soporte.'
            : 'Alcanzaste el límite de 3 alertas del plan gratuito. Ve a Mi Cuenta para actualizar a Premium.';
        } else {
          this.alertModalError = 'Error al crear la alerta. Intenta de nuevo.';
        }
        this.cdr.markForCheck();
      },
      complete: () => {
        this.alertModalSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleExistingAlert(): void {
    if (!this.alertModalExisting) return;
    const newStatus = !this.alertModalExisting.isActive;
    this.alertService.updateAlertStatus(this.alertModalExisting.id, { isActive: newStatus }).subscribe({
      next: () => {
        this.alertModalExisting!.isActive = newStatus;
        this.alertsByProductId[this.alertModalProduct!.id] = { ...this.alertModalExisting! };
        this.alertModalSuccess = newStatus ? 'Alerta activada.' : 'Alerta desactivada.';
        this.cdr.markForCheck();
      },
      error: () => {
        this.alertModalError = 'Error al cambiar estado.';
        this.cdr.markForCheck();
      }
    });
  }

  updateExistingAlertFrequency(): void {
    if (!this.alertModalExisting) return;
    this.alertService.updateAlert(this.alertModalExisting.id, {
      frequency: this.alertModalFrequency
    }).subscribe({
      next: () => {
        this.alertModalExisting!.frequency = this.alertModalFrequency;
        this.alertsByProductId[this.alertModalProduct!.id] = { ...this.alertModalExisting! };
        this.alertModalSuccess = 'Frecuencia actualizada.';
        this.cdr.markForCheck();
      },
      error: () => {
        this.alertModalError = 'Error al actualizar frecuencia.';
        this.cdr.markForCheck();
      }
    });
  }

  deleteExistingAlert(): void {
    if (!this.alertModalExisting || !confirm('¿Eliminar esta alerta?')) return;
    this.alertService.deleteAlert(this.alertModalExisting.id).subscribe({
      next: () => {
        delete this.alertsByProductId[this.alertModalProduct!.id];
        this.alertCount = Math.max(0, this.alertCount - 1);
        this.alertModalExisting = null;
        this.alertModalSuccess = 'Alerta eliminada.';
        this.cdr.markForCheck();
        setTimeout(() => this.closeAlertModal(), 1200);
      },
      error: () => {
        this.alertModalError = 'Error al eliminar la alerta.';
        this.cdr.markForCheck();
      }
    });
  }

  readonly getFrequencyLabel = getFrequencyLabel;
}