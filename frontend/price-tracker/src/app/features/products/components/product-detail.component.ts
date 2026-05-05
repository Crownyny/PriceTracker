import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { Product } from '../../../shared/models/product.model';
import { catchError, finalize, of } from 'rxjs';
import { AlertService } from '../../alerts/services/alert.service';
import { AlertFrequency } from '../../../shared/models/alert.model';
import { UserRoleService } from '../../../core/services/user-role.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {
  product: Product | null = null;
  isSaved = false;
  savingProduct = false;
  loading = false;
  error = '';
  alertError: string | null = null;
  alertLoading = false;
  hasAlert = false;
  alertCreated = false;
  private productId = '';
  private productRef = '';

  constructor(
    private productsService: ProductsService,
    private alertService: AlertService,
    private userRoleService: UserRoleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.productId = params['id'];
      this.productRef = this.route.snapshot.queryParamMap.get('productRef') || '';

      // Si el router pasó el objeto por state (navegación desde búsqueda) lo usamos
      const navigationProduct = (history.state?.product as Product | undefined) ?? null;
      if (navigationProduct?.id === this.productId) {
        this.product = navigationProduct;
        this.loading = false;
        this.refreshAlertState(navigationProduct.id);
        return;
      }

      this.loadProduct();
    });
  }

  loadProduct() {
    this.loading = true;
    this.error = '';

    const search$ = this.productRef
      ? this.productsService.getSearchFromDb(this.productRef).pipe(
          catchError(() => of({ productRef: this.productRef, products: [], totalResults: 0 }))
        )
      : of({ productRef: '', products: [], totalResults: 0 });

    search$.pipe(
      finalize(() => { this.loading = false; })
    ).subscribe((response: any) => {
      const product =
        response?.products?.find((item: Product) => item.id === this.productId) ||
        response?.products?.[0] ||
        null;

      if (!product) {
        this.error = 'No pudimos cargar el detalle del producto.';
        return;
      }

      this.product = product;
      this.refreshAlertState(product.id);
    });
  }

  // ── Guardar producto ──────────────────────────────────────────────────────

  saveProduct() {
    if (!this.product?.id || this.savingProduct) return;

    this.savingProduct = true;

    if (this.isSaved) {
      // Ya guardado → quitar
      this.productsService.unsaveProduct(this.product.id).pipe(
        finalize(() => { this.savingProduct = false; })
      ).subscribe({
        next: () => { this.isSaved = false; },
        error: () => { /* mantener estado visual */ this.isSaved = true; }
      });
    } else {
      // No guardado → guardar
      this.productsService.saveProduct(this.product.id).pipe(
        finalize(() => { this.savingProduct = false; })
      ).subscribe({
        next: () => { this.isSaved = true; },
        error: (err) => {
          // El endpoint puede retornar 4xx si ya está guardado; lo tratamos como éxito visual
          if (err?.status === 409 || err?.status === 400) {
            this.isSaved = true;
          }
          // En otros errores el botón queda en el estado previo
        }
      });
    }
  }

  // ── Crear / gestionar alerta ───────────────────────────────────────────────

  createAlert() {
    if (!this.product?.id) return;

    // Si ya existe alerta, redirigir al panel de alertas en modo gestión
    if (this.hasAlert) {
      this.router.navigate(['/alerts'], {
        queryParams: { productId: this.product.id }
      });
      return;
    }

    this.alertLoading = true;
    this.alertError = null;
    this.alertCreated = false;

    // NOTA: Crear alertas NO es una función premium-only.
    // El backend devuelve 403 si el usuario alcanzó el límite de su plan.
    const frequency: AlertFrequency = 'instant';

    this.alertService
      .createAlertWithoutDuplicate(this.product.id, { frequency })
      .pipe(
        catchError((err) => {
          if (err?.status === 409) {
            // El backend dice que ya existe → marcar como existente
            this.hasAlert = true;
            this.alertError = null;
          } else if (err?.status === 403) {
            this.alertError =
              'Alcanzaste el límite de alertas para tu plan actual. ' +
              (this.userRoleService.canUsePremiumFeatures()
                ? 'Contacta soporte.'
                : 'Mejora a Premium para crear más alertas.');
          } else {
            this.alertError = 'No fue posible crear la alerta. Intenta de nuevo.';
          }
          return of(null);
        }),
        finalize(() => { this.alertLoading = false; })
      )
      .subscribe((response) => {
        if (!response) return;

        if (response.message === 'ALERT_ALREADY_EXISTS') {
          this.hasAlert = true;
          this.alertCreated = false;
          this.alertError = null;
          return;
        }

        this.hasAlert = true;
        this.alertCreated = true;
        this.alertError = null;
      });
  }

  private refreshAlertState(productId: string): void {
    this.alertService
      .getAlerts(productId)
      .pipe(
        catchError(() => of({ alerts: [], total: 0, page: 0, pageSize: 0 }))
      )
      .subscribe((response) => {
        this.hasAlert =
          Array.isArray(response.alerts) && response.alerts.length > 0;
      });
  }
}