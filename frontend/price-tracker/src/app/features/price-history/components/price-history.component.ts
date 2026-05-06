import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PriceHistoryService } from '../services/price-history.service';
import { HttpConfigService } from '../../../core/services/http-config.service';
import { ProductsService } from '../../products/services/products.service';
import { TokenService } from '../../../core/services/token.service';
import { UserRoleService } from '../../../core/services/user-role.service';
import { AlertService } from '../../alerts/services/alert.service';
import { PriceHistoryResponse, PriceHistoryRange, PriceHistoryPoint } from '../../../shared/models/price-history.model';
import { Product } from '../../../shared/models/product.model';
import { Alert } from '../../../shared/models/alert.model';

interface ChartDot  { x: number; y: number; price: number; date: string; }
interface XLabel    { x: number; label: string; }
interface GridLabel { y: number; label: string; }

interface ProductWithAlert {
  id:          string;
  productName: string;
  alertId:     string;
  product:     Product | null;   // datos completos: imagen, tienda, url, precio
  allVariants: Product[];        // todas las variantes ordenadas por precio
}

@Component({
  selector: 'app-price-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './price-history.component.html',
  styleUrl: './price-history.component.css'
})
export class PriceHistoryComponent implements OnInit {

  // ── State ─────────────────────────────────────────────────────────────────
  selectedRange: PriceHistoryRange = 'W3';
  selectedProductId = '';
  priceData: PriceHistoryResponse | null = null;
  loading = false;
  error: string | null = null;
  productsWithAlerts: ProductWithAlert[] = [];
  alerts: Alert[] = [];

  /** El item actualmente seleccionado (para el panel de info) */
  get selectedItem(): ProductWithAlert | null {
    return this.productsWithAlerts.find(p => p.id === this.selectedProductId) ?? null;
  }

  // ── Chart ─────────────────────────────────────────────────────────────────
  polyline   = '';
  areaPath   = '';
  dots:       ChartDot[]  = [];
  xLabels:    XLabel[]    = [];
  gridLabels: GridLabel[] = [];
  gridYs:     number[]    = [];
  hoveredDot: ChartDot | null = null;

  readonly chartW = 900;
  readonly chartH = 280;
  readonly pL = 72; readonly pR = 20; readonly pT = 20; readonly pB = 36;

  readonly ranges = [
    { value: 'W1'  as PriceHistoryRange, label: 'Última semana'   },
    { value: 'W3'  as PriceHistoryRange, label: 'Último mes'      },
    { value: 'W12' as PriceHistoryRange, label: 'Últimos 3 meses' },
    { value: 'ALL' as PriceHistoryRange, label: 'Todo el periodo' },
  ];

  constructor(
    private priceHistoryService: PriceHistoryService,
    private productsService: ProductsService,
    private tokenService: TokenService,
    private userRoleService: UserRoleService,
    private alertService: AlertService,
    private router: Router,
    private httpConfig: HttpConfigService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.selectedRange = this.userRoleService.canUsePremiumFeatures() ? 'W3' : 'W1';
    this.loadAlertsWithProducts();
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  loadAlertsWithProducts(): void {
    this.loading = true;
    this.alertService.getAlerts().subscribe({
      next: (response) => {
        this.alerts = response.alerts;
        const active = this.alerts.filter(a => a.isActive !== false);

        if (!active.length) {
          this.productsWithAlerts = [];
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }

        const requests = active.map(alert => {
          // Usar directamente GET /api/products/{id}/product que ya fue corregido
          // por el backend. Devuelve: id, product_ref, source_name, canonical_name,
          // price, currency, category, availability, source_url, image_url
          return this.productsService.getProduct(alert.productId).pipe(
            map(product => {
              // Guardar en caché completo para próximas visitas
              if (product?.id) this.productsService.cacheFullProduct(product);

              return <ProductWithAlert>{
                id:          alert.productId,
                productName: product?.name || `Producto ${alert.productId.slice(0, 8)}…`,
                alertId:     alert.id,
                product:     product,
                allVariants: product ? [product] : []
              };
            }),
            catchError(() => {
              // Fallback al caché si el endpoint falla
              const cached = this.productsService.getCachedProduct(alert.productId);
              return of(<ProductWithAlert>{
                id:          alert.productId,
                productName: cached?.name ||
                             this.productsService.getCachedName(alert.productId) ||
                             `Producto ${alert.productId.slice(0, 8)}…`,
                alertId:     alert.id,
                product:     cached,
                allVariants: cached ? [cached] : []
              });
            })
          );
        });

        forkJoin(requests).subscribe({
          next: items => {
            this.productsWithAlerts = items;
            this.cdr.markForCheck();
            if (items.length) {
              this.selectedProductId = items[0].id;
              this.loadHistory(items[0].id);
            } else {
              this.loading = false;
            }
          },
          error: () => {
            this.productsWithAlerts = active.map(a => ({
              id: a.productId,
              productName: a.productRef || `Producto ${a.productId.slice(0,8)}…`,
              alertId: a.id, product: null, allVariants: []
            }));
            this.loading = false;
            this.cdr.markForCheck();
          }
        });
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  onProductChange(): void {
    if (this.selectedProductId) {
      this.priceData = null;
      this.clearChart();
      this.loadHistory(this.selectedProductId);
    }
  }

  onRangeChange(): void {
    if (this.selectedProductId) this.loadHistory(this.selectedProductId);
  }

  private loadHistory(productId: string): void {
    this.loading = true;
    this.error = null;
    this.priceHistoryService.getPriceHistory(productId, this.selectedRange).subscribe({
      next: resp => {
        this.priceData = resp;
        this.buildChart(resp.history);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.error = `Error (${err?.status ?? '?'}): ${err?.error?.message || 'No se pudo cargar el historial.'}`;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Chart ─────────────────────────────────────────────────────────────────

  private buildChart(history: PriceHistoryPoint[]): void {
    this.clearChart();
    if (!history?.length) return;

    const sorted = [...history].sort((a, b) =>
      new Date(a.updatedAt ?? (a as any).recordedAt).getTime() -
      new Date(b.updatedAt ?? (b as any).recordedAt).getTime()
    );

    const prices = sorted.map(p => Number(p.price)).filter(v => v > 0);
    const times  = sorted.map(p => new Date(p.updatedAt ?? (p as any).recordedAt).getTime()).filter(t => !isNaN(t));
    if (!prices.length || !times.length) return;

    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const minT = Math.min(...times),  maxT = Math.max(...times);
    const rangeP = maxP - minP || 1,  rangeT = maxT - minT || 1;
    const plotW = this.chartW - this.pL - this.pR;
    const plotH = this.chartH - this.pT - this.pB;
    const toX = (t: number) => this.pL + ((t - minT) / rangeT) * plotW;
    const toY = (p: number) => this.pT + plotH - ((p - minP) / rangeP) * plotH;

    const pts = sorted.map(pt => {
      const t = new Date(pt.updatedAt ?? (pt as any).recordedAt).getTime();
      const d = new Date(t);
      return {
        x: toX(t), y: toY(Number(pt.price)),
        price: Number(pt.price),
        date: `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
      };
    });

    this.dots     = pts;
    this.polyline = pts.map(d => `${d.x},${d.y}`).join(' ');

    const baseY = this.pT + plotH;
    this.areaPath = `M${pts[0].x},${baseY} ` + pts.map(d => `L${d.x},${d.y}`).join(' ') + ` L${pts[pts.length-1].x},${baseY} Z`;

    for (let i = 0; i <= 5; i++) {
      const price = minP + rangeP * i / 5;
      const y = toY(price);
      this.gridYs.push(y);
      this.gridLabels.push({ y, label: this.fmtChartPrice(price) });
    }

    const count = Math.min(6, sorted.length);
    for (let i = 0; i < count; i++) {
      const t = minT + rangeT * i / Math.max(count - 1, 1);
      const d = new Date(t);
      this.xLabels.push({ x: toX(t), label: `${d.getDate()}/${d.getMonth()+1}` });
    }
  }

  private clearChart(): void {
    this.polyline = ''; this.areaPath = '';
    this.dots = []; this.xLabels = [];
    this.gridYs = []; this.gridLabels = [];
    this.hoveredDot = null;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  get currentPrice(): number {
    if (!this.priceData?.history.length) return 0;
    return Number([...this.priceData.history].sort((a, b) =>
      new Date(b.updatedAt ?? (b as any).recordedAt).getTime() -
      new Date(a.updatedAt ?? (a as any).recordedAt).getTime()
    )[0].price);
  }

  getMinPrice():     number { return this.priceData ? Math.min(...this.priceData.history.map(h => h.price)) : 0; }
  getMaxPrice():     number { return this.priceData ? Math.max(...this.priceData.history.map(h => h.price)) : 0; }
  getAveragePrice(): number {
    if (!this.priceData?.history.length) return 0;
    return this.priceData.history.reduce((a, h) => a + h.price, 0) / this.priceData.history.length;
  }

  rangeLabel(): string { return this.ranges.find(r => r.value === this.selectedRange)?.label ?? ''; }

  fmtPrice(p: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(p);
  }

  private fmtChartPrice(p: number): string {
    if (p >= 1_000_000) return `$${(p/1_000_000).toFixed(1)}M`;
    if (p >= 1_000)     return `$${(p/1_000).toFixed(0)}k`;
    return `$${p.toFixed(0)}`;
  }

  savings(item: ProductWithAlert): number {
    if (item.allVariants.length < 2) return 0;
    const max = Math.max(...item.allVariants.map(v => v.currentPrice));
    return max - (item.product?.currentPrice ?? 0);
  }

  savingsPct(item: ProductWithAlert): number {
    const max = item.allVariants.length > 1 ? Math.max(...item.allVariants.map(v => v.currentPrice)) : 0;
    if (!max) return 0;
    return ((max - (item.product?.currentPrice ?? 0)) / max) * 100;
  }

  setHovered(dot: ChartDot | null): void { this.hoveredDot = dot; }
  goToAlerts(): void { this.router.navigate(['/alerts']); }
  goToProduct(item: ProductWithAlert): void {
    const ref = item.product?.productRef || item.allVariants[0]?.productRef || '';
    this.router.navigate(['/product', item.id], {
      queryParams: ref ? { productRef: ref } : {},
      state: item.product ? { productResult: { best: item.product, all: item.allVariants } } : {}
    });
  }
}