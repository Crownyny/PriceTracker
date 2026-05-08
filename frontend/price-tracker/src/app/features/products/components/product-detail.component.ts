import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ProductsService } from '../services/products.service';
import { PriceHistoryService } from '../../price-history/services/price-history.service';
import { AlertService } from '../../alerts/services/alert.service';
import { UserRoleService } from '../../../core/services/user-role.service';
import { Product, ProductSource } from '../../../shared/models/product.model';
import { AlertFrequency } from '../../../shared/models/alert.model';
import { PriceHistoryRange, PriceHistoryPoint } from '../../../shared/models/price-history.model';

interface ChartSeries {
  sourceName: string;
  points: string;      // polyline points attribute
  dots: { x: number; y: number }[];
}

interface ComparisonItem {
  sourceName: string;
  price: number;
  shippingCost: number;
  url: string;
  logo?: string;
  availability: boolean;
}

interface XLabel { x: number; label: string; }
interface GridLabel { y: number; label: string; }

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {

  // ── Product state ─────────────────────────────────────────────────────────
  product: Product | null = null;
  loading      = false;
  error        = '';

  // ── Save state ────────────────────────────────────────────────────────────
  isSaved      = false;
  savingProduct = false;

  // ── Alert state ───────────────────────────────────────────────────────────
  hasAlert     = false;
  alertCreated = false;
  alertLoading = false;
  alertError: string | null = null;

  // ── Price comparison ──────────────────────────────────────────────────────
  priceComparison: ComparisonItem[] = [];

  // ── Chart ─────────────────────────────────────────────────────────────────
  chartSeries:   ChartSeries[] = [];
  gridYs:        number[]      = [];
  gridLabels:    GridLabel[]   = [];
  xLabels:       XLabel[]      = [];
  historyLoading = false;
  selectedRange: PriceHistoryRange = 'W1'; // se actualiza en ngOnInit según el rol

  readonly chartW      = 700;
  readonly chartH      = 260;
  readonly paddingLeft = 64;
  readonly paddingRight = 16;
  readonly paddingTop  = 16;
  readonly paddingBottom = 32;

  readonly ranges = [
    { value: 'W1'  as PriceHistoryRange, label: 'Última semana'   },
    { value: 'W3'  as PriceHistoryRange, label: 'Último mes'      },
    { value: 'W12' as PriceHistoryRange, label: 'Últimos 3 meses' },
    { value: 'ALL' as PriceHistoryRange, label: 'Todo el periodo' },
  ];

  private readonly SERIES_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6'];

  private productId  = '';
  private productRef = '';

  constructor(
    private productsService:     ProductsService,
    private priceHistoryService: PriceHistoryService,
    private alertService:        AlertService,
    private userRoleService:     UserRoleService,
    private route:  ActivatedRoute,
    private router: Router,
    private cdr:    ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Freemium solo puede usar W1 — evita el 400 del backend
    this.selectedRange = this.userRoleService.canUsePremiumFeatures() ? 'W3' : 'W1';
    this.route.params.subscribe(params => {
      this.productId  = params['id'];
      this.productRef = this.route.snapshot.queryParamMap.get('productRef') ?? '';
      this.isSaved    = this.productsService.isProductSaved(this.productId);

      // Si viene con el objeto completo desde open-product (history.state)
      const stateProduct = (history.state?.product as Product | undefined) ?? null;
      if (stateProduct?.id === this.productId) {
        this.product = stateProduct;
        this.buildComparison(stateProduct);
        this.refreshAlertState(stateProduct.id);
        this.loadHistory(stateProduct.id);
        this.cdr.markForCheck();
        return;
      }

      this.loadProduct();
    });
  }

  // ── Load product ──────────────────────────────────────────────────────────

  loadProduct(): void {
    this.loading = true;
    this.error   = '';

    if (this.productRef) {
      this.productsService.getProductByIdAndRef(this.productId, this.productRef)
        .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
        .subscribe((result: { best: Product; all: Product[] } | null) => {
          if (!result) { this.error = 'No pudimos cargar el detalle del producto.'; this.cdr.markForCheck(); return; }
          this.product = result.best;
          this.buildComparison(result.best);
          this.refreshAlertState(result.best.id);
          this.loadHistory(result.best.id);
          this.cdr.markForCheck();
        });
    } else {
      this.productsService.getProduct(this.productId)
        .pipe(
          catchError(() => of(null as Product | null)),
          finalize(() => { this.loading = false; this.cdr.markForCheck(); })
        )
        .subscribe((product: Product | null) => {
          if (!product) { this.error = 'No pudimos cargar el detalle del producto.'; this.cdr.markForCheck(); return; }
          this.product = product;
          this.buildComparison(product);
          this.refreshAlertState(product.id);
          this.loadHistory(product.id);
          this.cdr.markForCheck();
        });
    }
  }

  // ── Price comparison ──────────────────────────────────────────────────────

  /**
   * Construye la lista de comparación de tiendas a partir del producto.
   * El backend devuelve múltiples entradas por producto (una por tienda) en el
   * array `products` de la búsqueda — usamos los campos `source`, `currentPrice`, etc.
   * Si el objeto Product tiene una sola tienda, se muestra sola.
   */
  private buildComparison(product: Product): void {
    // Caso 1: el producto tiene fuentes múltiples en un campo `sources`
    const sources = (product as any).sources as ProductSource[] | undefined;
    if (sources?.length) {
      this.priceComparison = sources
        .filter(s => s.availability !== false)
        .map(s => ({
          sourceName:   s.sourceName || s.sourceId || '—',
          price:        s.price,
          shippingCost: s.shippingCost ?? 0,
          url:          s.url || '',
          logo:         (s as any).logo,
          availability: s.availability
        }))
        .sort((a, b) => a.price - b.price)
        .slice(0, 6);
      return;
    }

    // Caso 2: un único source en el producto raíz
    if (product.source && product.currentPrice) {
      this.priceComparison = [{
        sourceName:   product.source,
        price:        product.currentPrice,
        shippingCost: 0,
        url:          (product as any).url || '',
        availability: product.availability
      }];
    }
  }

  // ── Best price helpers (usados en el template) ────────────────────────────

  bestPrice(): number {
    if (this.priceComparison.length) return this.priceComparison[0].price;
    return this.product?.currentPrice ?? 0;
  }

  bestSource(): string {
    if (this.priceComparison.length) return this.priceComparison[0].sourceName;
    return this.product?.source ?? '—';
  }

  bestUrl(): string {
    return this.priceComparison[0]?.url || (this.product as any)?.url || '';
  }

  savings(): number {
    if (this.priceComparison.length < 2) return this.product?.savings ?? 0;
    const max = Math.max(...this.priceComparison.map(c => c.price));
    return max - this.priceComparison[0].price;
  }

  savingsPercent(): number {
    if (this.priceComparison.length < 2) return this.product?.savingsPercent ?? 0;
    const max = Math.max(...this.priceComparison.map(c => c.price));
    if (!max) return 0;
    return ((max - this.priceComparison[0].price) / max) * 100;
  }

  // ── Save product ──────────────────────────────────────────────────────────

  saveProduct(): void {
    if (!this.product?.id || this.savingProduct) return;
    this.savingProduct = true;

    const action$ = this.isSaved
      ? this.productsService.unsaveProduct(this.product.id)
      : this.productsService.saveProduct(this.product.id);

    action$.pipe(finalize(() => { this.savingProduct = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => { this.isSaved = !this.isSaved; this.cdr.markForCheck(); },
        error: (err) => {
          if (!this.isSaved && (err?.status === 409 || err?.status === 400)) this.isSaved = true;
          this.cdr.markForCheck();
        }
      });
  }

  // ── Create alert ──────────────────────────────────────────────────────────

  createAlert(): void {
    if (!this.product?.id) return;

    if (this.hasAlert) {
      this.router.navigate(['/alerts'], { queryParams: { productId: this.product.id } });
      return;
    }

    this.alertLoading = true;
    this.alertError   = null;
    this.alertCreated = false;

    this.alertService
      .createAlertWithoutDuplicate(this.product.id, { frequency: 'instant' as AlertFrequency })
      .pipe(
        catchError(err => {
          if (err?.status === 409) {
            this.hasAlert = true;
          } else if (
            err?.status === 403 ||
            (err?.status === 400 &&
              String(err?.error?.message ?? '').toLowerCase().includes('maximum'))
          ) {
            // Backend devuelve 400 con "Maximum number of alerts reached for freemium users"
            this.alertError = 'UPGRADE_REQUIRED';
          } else {
            this.alertError = 'No fue posible crear la alerta. Intenta de nuevo.';
          }
          this.cdr.markForCheck();
          return of(null);
        }),
        finalize(() => { this.alertLoading = false; this.cdr.markForCheck(); })
      )
      .subscribe(response => {
        if (!response) { this.cdr.markForCheck(); return; }
        this.hasAlert     = true;
        this.alertCreated = response.message !== 'ALERT_ALREADY_EXISTS';
        this.alertError   = null;
        this.cdr.markForCheck();
      });
  }

  // ── Price history chart ───────────────────────────────────────────────────

  setRange(range: PriceHistoryRange): void {
    this.selectedRange = range;
    if (this.product?.id) this.loadHistory(this.product.id);
  }

  chartRangeLabel(): string {
    return this.ranges.find(r => r.value === this.selectedRange)?.label ?? '';
  }

  seriesColor(index: number): string {
    return this.SERIES_COLORS[index % this.SERIES_COLORS.length];
  }

  private loadHistory(productId: string): void {
    this.historyLoading = true;
    this.chartSeries    = [];
    this.gridYs         = [];
    this.gridLabels     = [];
    this.xLabels        = [];

    this.priceHistoryService.getPriceHistory(productId, this.selectedRange)
      .pipe(
        catchError(() => of(null)),
        finalize(() => { this.historyLoading = false; this.cdr.markForCheck(); })
      )
      .subscribe(response => {
        if (!response?.history?.length) { this.cdr.markForCheck(); return; }
        this.buildChart(response.history);
        this.cdr.markForCheck();
      });
  }

  private buildChart(history: PriceHistoryPoint[]): void {
    // Agrupar por source (una línea por tienda)
    const bySource = new Map<string, PriceHistoryPoint[]>();
    for (const point of history) {
      const key = (point as any).sourceName || point.source || 'Precio';
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key)!.push(point);
    }

    // Si no hay fuentes distintas, usar una sola serie con todo
    if (bySource.size === 0) return;

    // Calcular rango global de precio y tiempo
    const allPrices = history.map(p => Number(p.price)).filter(v => v > 0);
    const allTimes  = history.map(p => new Date(p.updatedAt).getTime()).filter(t => !isNaN(t));

    if (!allPrices.length || !allTimes.length) return;

    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const minT = Math.min(...allTimes);
    const maxT = Math.max(...allTimes);

    const priceRange = maxP - minP || 1;
    const timeRange  = maxT - minT || 1;

    const plotW = this.chartW - this.paddingLeft - this.paddingRight;
    const plotH = this.chartH - this.paddingTop - this.paddingBottom;

    const toX = (t: number) => this.paddingLeft + ((t - minT) / timeRange) * plotW;
    const toY = (p: number) => this.paddingTop + plotH - ((p - minP) / priceRange) * plotH;

    // Build series
    this.chartSeries = Array.from(bySource.entries()).slice(0, 6).map(([name, points]) => {
      const sorted = [...points].sort((a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );

      const dots = sorted.map(p => ({
        x: toX(new Date(p.updatedAt).getTime()),
        y: toY(Number(p.price))
      }));

      return {
        sourceName: name,
        points: dots.map(d => `${d.x},${d.y}`).join(' '),
        dots
      };
    });

    // Grid Y lines (5 levels)
    const steps = 5;
    this.gridYs     = [];
    this.gridLabels = [];
    for (let i = 0; i <= steps; i++) {
      const price = minP + (priceRange * i / steps);
      const y     = toY(price);
      this.gridYs.push(y);
      this.gridLabels.push({ y, label: this.formatChartPrice(price) });
    }

    // X axis labels (up to 6 dates)
    const labelCount = Math.min(6, history.length);
    this.xLabels = [];
    for (let i = 0; i < labelCount; i++) {
      const t     = minT + (timeRange * i / Math.max(labelCount - 1, 1));
      const date  = new Date(t);
      this.xLabels.push({
        x:     toX(t),
        label: `${date.getDate()}/${date.getMonth() + 1}`
      });
    }
  }

  private formatChartPrice(price: number): string {
    if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
    if (price >= 1_000)     return `$${(price / 1_000).toFixed(0)}k`;
    return `$${price.toFixed(0)}`;
  }

  // ── Alert state ───────────────────────────────────────────────────────────

  private refreshAlertState(productId: string): void {
    this.alertService.getAlerts(productId)
      .pipe(catchError(() => of({ alerts: [], total: 0, page: 0, pageSize: 0 })))
      .subscribe(resp => {
        this.hasAlert = Array.isArray(resp.alerts) && resp.alerts.length > 0;
        this.cdr.markForCheck();
      });
  }
}