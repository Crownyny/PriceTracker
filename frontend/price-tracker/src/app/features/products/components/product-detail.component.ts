import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { formatChartPrice } from '../../../shared/utils/chart.utils';

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
  imports: [CommonModule, RouterLink, FormsModule],
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
  saveError:   'UPGRADE_REQUIRED' | null = null;
  saveMessage: string | null = null;
  private saveMessageTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly FREE_PRODUCT_LIMIT = 5;

  // ── Alert state ───────────────────────────────────────────────────────────
  hasAlert     = false;
  alertCreated = false;
  alertLoading = false;
  alertError: string | null = null;

  // ── Price comparison ──────────────────────────────────────────────────────
  priceComparison: ComparisonItem[] = [];

  // ── Filters (HE-06) ───────────────────────────────────────────────────────
  sortOrder: 'asc' | 'desc' = 'asc';
  priceMin: number | null = null;
  priceMax: number | null = null;

  get filteredComparison(): ComparisonItem[] {
    let items = [...this.priceComparison];

    if (this.priceMin !== null) {
      items = items.filter(i => i.price >= this.priceMin!);
    }
    if (this.priceMax !== null) {
      items = items.filter(i => i.price <= this.priceMax!);
    }

    items.sort((a, b) =>
      this.sortOrder === 'asc' ? a.price - b.price : b.price - a.price
    );

    return items;
  }

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
    // Detecta cambios externos de rol — actualiza el rango del historial
    this.userRoleService.fetchAndSyncRole().subscribe(role => {
      this.selectedRange = role === 'premium' ? 'W3' : 'W1';
      this.cdr.markForCheck();
    });
    this.route.params.subscribe(params => {
      this.productId  = params['id'];
      this.productRef = this.route.snapshot.queryParamMap.get('productRef') ?? '';
      this.isSaved    = this.productsService.isProductSaved(this.productId);
      // Sincronizar estado real desde el backend (otro dispositivo puede haberlo guardado)
      this.productsService.syncSavedIds().subscribe(ids => {
        this.isSaved = ids.includes(this.productId);
        this.cdr.markForCheck();
      });

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
   * Construye priceComparison buscando todas las tiendas del mismo productRef.
   * Si el producto ya viene con múltiples sources (campo `sources`), los usa directamente.
   * Si no, hace getSearchFromDb(productRef) para traer todas las tiendas en paralelo.
   */
  private buildComparison(product: Product): void {
    // Caso 1: el backend ya devolvió múltiples sources en el objeto
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
        .sort((a, b) => a.price - b.price);
      return;
    }

    // Caso 2: construir desde el producto raíz con el resultado inicial
    if (product.source && product.currentPrice) {
      this.priceComparison = [{
        sourceName:   product.source,
        price:        product.currentPrice,
        shippingCost: 0,
        url:          (product as any).url || '',
        availability: product.availability
      }];
    }

    // Caso 3: enriquecer con todas las tiendas disponibles via búsqueda
    const ref = product.productRef || this.productRef;
    if (!ref) return;

    this.productsService.getSearchFromDb(ref).subscribe({
      next: (response) => {
        const allProducts = response.products ?? [];
        if (allProducts.length < 2) return;

        this.priceComparison = allProducts
          .filter(p => p.source && p.currentPrice)
          .map(p => ({
            sourceName:   p.source ?? '—',
            price:        p.currentPrice ?? 0,
            shippingCost: 0,
            url:          (p as any).url || (p as any).source_url || '',
            availability: p.availability ?? true
          }))
          .sort((a, b) => a.price - b.price);

        this.cdr.markForCheck();
      }
    });
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

    const isPremium = this.userRoleService.canUsePremiumFeatures();
    if (!this.isSaved && !isPremium) {
      // Verificar contra el backend para evitar contar con localStorage desactualizado
      this.productsService.syncSavedIds().subscribe(ids => {
        if (ids.length >= this.FREE_PRODUCT_LIMIT) {
          this.saveError = 'UPGRADE_REQUIRED';
          this.cdr.markForCheck();
          return;
        }
        this.executeSave();
      });
      return;
    }

    this.executeSave();
  }

  private executeSave(): void {
    if (!this.product?.id || this.savingProduct) return;
    this.saveError = null;
    this.savingProduct = true;

    const action$ = this.isSaved
      ? this.productsService.unsaveProduct(this.product.id)
      : this.productsService.saveProduct(this.product.id);

    action$.pipe(finalize(() => { this.savingProduct = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          const wasUnsaved = !this.isSaved;
          this.isSaved = !this.isSaved;
          // Mostrar mensaje de confirmación — desaparece solo después de 3s
          this.saveMessage = wasUnsaved ? '✓ Producto guardado' : '✓ Producto quitado de guardados';
          if (this.saveMessageTimer) clearTimeout(this.saveMessageTimer);
          this.saveMessageTimer = setTimeout(() => {
            this.saveMessage = null;
            this.cdr.markForCheck();
          }, 3000);
          this.cdr.markForCheck();
        },
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
      this.gridLabels.push({ y, label: formatChartPrice(price) });
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