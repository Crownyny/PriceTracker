import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { ProductsService } from '../services/products.service';
import { PriceHistoryService } from '../../price-history/services/price-history.service';
import { AlertService } from '../../alerts/services/alert.service';
import { UserRoleService } from '../../../core/services/user-role.service';
import { Product } from '../../../shared/models/product.model';
import { AlertFrequency } from '../../../shared/models/alert.model';
import { PriceHistoryRange, PriceHistoryPoint } from '../../../shared/models/price-history.model';

interface StoreRow {
  name: string;
  logo: string;
  price: number;
  diff: number;          // diferencia vs. precio mínimo
  shipping: number;      // 0 = gratis
  url: string;
  isBest: boolean;
  image?: string;
}

interface ChartSeries {
  sourceName: string;
  polyline: string;
  dots: { x: number; y: number }[];
}

interface GridLabel { y: number; label: string; }
interface XLabel    { x: number; label: string; }

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {

  // ── State ─────────────────────────────────────────────────────────────────
  product:      Product | null = null;
  allVariants:  Product[]      = [];   // todos los resultados del productRef
  storeRows:    StoreRow[]     = [];   // comparación de tiendas ordenada por precio
  loading       = false;
  error         = '';

  isSaved       = false;
  savingProduct = false;

  hasAlert      = false;
  alertCreated  = false;
  alertLoading  = false;
  alertError: string | null = null;

  // ── Chart ─────────────────────────────────────────────────────────────────
  chartSeries:    ChartSeries[] = [];
  gridLabels:     GridLabel[]   = [];
  gridYs:         number[]      = [];
  xLabels:        XLabel[]      = [];
  historyLoading  = false;
  selectedRange: PriceHistoryRange = 'W3';

  readonly ranges = [
    { value: 'W1'  as PriceHistoryRange, label: 'Última semana'   },
    { value: 'W3'  as PriceHistoryRange, label: 'Último mes'      },
    { value: 'W12' as PriceHistoryRange, label: 'Últimos 3 meses' },
    { value: 'ALL' as PriceHistoryRange, label: 'Todo el periodo' },
  ];

  readonly chartW = 680;
  readonly chartH = 220;
  readonly pL = 60; readonly pR = 16; readonly pT = 12; readonly pB = 28;

  private readonly COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7'];

  private productId  = '';
  private productRef = '';

  constructor(
    private productsService:     ProductsService,
    private priceHistoryService: PriceHistoryService,
    private alertService:        AlertService,
    private userRoleService:     UserRoleService,
    private route:  ActivatedRoute,
    private router: Router
  ) {}

  // ── Init ──────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.productId  = params['id'];
      this.productRef = this.route.snapshot.queryParamMap.get('productRef') ?? '';
      this.isSaved    = this.productsService.isProductSaved(this.productId);

      // Si open-product pasó el objeto completo por state, usarlo directamente
      const stateResult = history.state?.productResult as
        { best: Product; all: Product[] } | undefined;

      if (stateResult?.best) {
        this.applyProducts(stateResult.best, stateResult.all);
        return;
      }

      this.loadProduct();
    });
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  loadProduct(): void {
    this.loading = true;
    this.error   = '';

    if (this.productRef) {
      // Con productRef: traemos todas las variantes, best = más barato
      this.productsService.getProductByIdAndRef(this.productId, this.productRef)
        .pipe(finalize(() => { this.loading = false; }))
        .subscribe((result: { best: Product; all: Product[] } | null) => {
          if (!result) { this.error = 'No pudimos cargar el detalle del producto.'; return; }
          this.applyProducts(result.best, result.all);
        });
    } else {
      // Sin productRef: endpoint directo (puede devolver 500; manejamos el error)
      this.productsService.getProduct(this.productId)
        .pipe(
          catchError(() => of(null as Product | null)),
          finalize(() => { this.loading = false; })
        )
        .subscribe((product: Product | null) => {
          if (!product) { this.error = 'No pudimos cargar el detalle del producto.'; return; }
          this.applyProducts(product, [product]);
        });
    }
  }

  private applyProducts(best: Product, all: Product[]): void {
    this.product     = best;
    this.allVariants = all;
    this.buildStoreRows(all);
    this.refreshAlertState(best.id);
    this.loadHistory(best.id);
    // Cachear producto completo (imagen, tienda, URL) para historial y alertas
    if (best.id) this.productsService.cacheFullProduct(best);
    // Cachear también todas las variantes
    all.forEach(v => { if (v.id) this.productsService.cacheFullProduct(v); });
  }

  // ── Store rows ────────────────────────────────────────────────────────────

  private buildStoreRows(variants: Product[]): void {
    if (!variants.length) return;

    const sorted = [...variants]
      .filter(v => v.currentPrice > 0)
      .sort((a, b) => a.currentPrice - b.currentPrice);

    const minPrice = sorted[0]?.currentPrice ?? 0;

    this.storeRows = sorted.slice(0, 8).map((v, i) => ({
      name:     v.source     ?? 'Tienda',
      logo:     this.buildLogo(v.source ?? ''),
      price:    v.currentPrice,
      diff:     i === 0 ? 0 : v.currentPrice - minPrice,
      shipping: 0,              // El backend no expone shipping separado; se asume gratis
      url:      (v as any).url ?? '',
      isBest:   i === 0,
      image:    v.image,
    }));
  }

  private buildLogo(sourceName: string): string {
    const s = sourceName.toLowerCase();
    const map: Record<string, string> = {
      mercadolibre: 'https://http2.mlstatic.com/frontend-assets/ui-navigation/5.20.0/mercadolibre/favicon.svg',
      amazon:       'https://www.amazon.com/favicon.ico',
      walmart:      'https://www.walmart.com/favicon.ico',
      liverpool:    'https://www.liverpool.com.mx/favicon.ico',
      jumbo:        'https://www.jumbo.com.co/favicon.ico',
      falabella:    'https://www.falabella.com.co/favicon.ico',
      exito:        'https://www.exito.com/favicon.ico',
    };
    for (const [key, url] of Object.entries(map)) {
      if (s.includes(key)) return url;
    }
    return '';
  }

  // ── Best price helpers ────────────────────────────────────────────────────

  get bestRow(): StoreRow | null   { return this.storeRows[0] ?? null; }
  get bestPrice(): number          { return this.bestRow?.price ?? this.product?.currentPrice ?? 0; }
  get bestSource(): string         { return this.bestRow?.name ?? this.product?.source ?? '—'; }
  get bestUrl(): string            { return this.bestRow?.url ?? (this.product as any)?.url ?? ''; }

  get maxPrice(): number {
    return this.storeRows.length > 1
      ? Math.max(...this.storeRows.map(r => r.price))
      : this.bestPrice;
  }

  get savings(): number    { return this.maxPrice - this.bestPrice; }
  get savingsPct(): number { return this.maxPrice > 0 ? (this.savings / this.maxPrice) * 100 : 0; }

  // ── Save ──────────────────────────────────────────────────────────────────

  saveProduct(): void {
    if (!this.product?.id || this.savingProduct) return;
    this.savingProduct = true;

    const action$ = this.isSaved
      ? this.productsService.unsaveProduct(this.product.id)
      : this.productsService.saveProduct(this.product.id);

    action$.pipe(finalize(() => { this.savingProduct = false; }))
      .subscribe({
        next: () => { this.isSaved = !this.isSaved; },
        error: (err) => { if (!this.isSaved && (err?.status === 409 || err?.status === 400)) this.isSaved = true; }
      });
  }

  // ── Alert ─────────────────────────────────────────────────────────────────

  createAlert(): void {
    if (!this.product?.id) return;

    if (this.hasAlert) {
      this.router.navigate(['/alerts'], { queryParams: { productId: this.product.id } });
      return;
    }

    this.alertLoading = true;
    this.alertError   = null;
    this.alertCreated = false;

    // Cachear el producto completo para que historial/alertas tengan imagen, tienda y URL
    if (this.product.id) {
      this.productsService.cacheFullProduct(this.product);
    }

    this.alertService
      .createAlertWithoutDuplicate(this.product.id, { frequency: 'instant' as AlertFrequency })
      .pipe(
        catchError(err => {
          if (err?.status === 409)      { this.hasAlert = true; }
          else if (err?.status === 403) {
            this.alertError = this.userRoleService.canUsePremiumFeatures()
              ? 'Límite de alertas alcanzado. Contacta soporte.'
              : 'Límite de alertas de tu plan. Mejora a Premium.';
          } else {
            this.alertError = 'No fue posible crear la alerta. Intenta de nuevo.';
          }
          return of(null);
        }),
        finalize(() => { this.alertLoading = false; })
      )
      .subscribe(response => {
        if (!response) return;
        this.hasAlert     = true;
        this.alertCreated = response.message !== 'ALERT_ALREADY_EXISTS';
        this.alertError   = null;
      });
  }

  private refreshAlertState(productId: string): void {
    this.alertService.getAlerts(productId)
      .pipe(catchError(() => of({ alerts: [], total: 0, page: 0, pageSize: 0 })))
      .subscribe(resp => { this.hasAlert = Array.isArray(resp.alerts) && resp.alerts.length > 0; });
  }

  // ── Chart ─────────────────────────────────────────────────────────────────

  setRange(range: PriceHistoryRange): void {
    this.selectedRange = range;
    if (this.product?.id) this.loadHistory(this.product.id);
  }

  rangeLabel(): string {
    return this.ranges.find(r => r.value === this.selectedRange)?.label ?? '';
  }

  seriesColor(i: number): string { return this.COLORS[i % this.COLORS.length]; }

  private loadHistory(productId: string): void {
    this.historyLoading = true;
    this.chartSeries = []; this.gridLabels = []; this.gridYs = []; this.xLabels = [];

    this.priceHistoryService.getPriceHistory(productId, this.selectedRange)
      .pipe(catchError(() => of(null)), finalize(() => { this.historyLoading = false; }))
      .subscribe(resp => { if (resp?.history?.length) this.buildChart(resp.history); });
  }

  private buildChart(history: PriceHistoryPoint[]): void {
    // Group by source
    const bySource = new Map<string, PriceHistoryPoint[]>();
    for (const p of history) {
      const k = (p as any).sourceName ?? p.source ?? 'Precio';
      if (!bySource.has(k)) bySource.set(k, []);
      bySource.get(k)!.push(p);
    }

    const allPrices = history.map(p => Number(p.price)).filter(v => v > 0);
    const allTimes  = history.map(p => new Date(p.updatedAt).getTime()).filter(t => !isNaN(t));
    if (!allPrices.length || !allTimes.length) return;

    const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
    const minT = Math.min(...allTimes),  maxT = Math.max(...allTimes);
    const priceR = maxP - minP || 1, timeR = maxT - minT || 1;
    const plotW = this.chartW - this.pL - this.pR;
    const plotH = this.chartH - this.pT - this.pB;

    const toX = (t: number) => this.pL + ((t - minT) / timeR) * plotW;
    const toY = (p: number) => this.pT + plotH - ((p - minP) / priceR) * plotH;

    this.chartSeries = Array.from(bySource.entries()).slice(0, 6).map(([name, pts]) => {
      const sorted = [...pts].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      const dots = sorted.map(p => ({ x: toX(new Date(p.updatedAt).getTime()), y: toY(Number(p.price)) }));
      return { sourceName: name, polyline: dots.map(d => `${d.x},${d.y}`).join(' '), dots };
    });

    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const price = minP + priceR * i / steps;
      const y = toY(price);
      this.gridYs.push(y);
      this.gridLabels.push({ y, label: this.fmtChartPrice(price) });
    }

    const lblCount = Math.min(6, history.length);
    for (let i = 0; i < lblCount; i++) {
      const t = minT + timeR * i / Math.max(lblCount - 1, 1);
      const d = new Date(t);
      this.xLabels.push({ x: toX(t), label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
  }

  private fmtChartPrice(p: number): string {
    if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(1)}M`;
    if (p >= 1_000)     return `$${(p / 1_000).toFixed(0)}k`;
    return `$${p.toFixed(0)}`;
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  fmtPrice(price: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(price);
  }
}