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
  loading = false;
  error = '';
  alertError: string | null = null;
  alertLoading = false;
  hasAlert = false;
  alertCreated = false;
  premiumBlocked = false;
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

      const navigationProduct = (history.state?.product as Product | undefined) ?? null;
      if (navigationProduct?.id === this.productId) {
        this.product = navigationProduct;
        this.loading = false;
        if (navigationProduct?.id) {
          this.refreshAlertState(navigationProduct.id);
        }
        return;
      }

      this.loadProduct();
    });
  }

  loadProduct() {
    this.loading = true;
    const productFromDb$ = this.productRef
      ? this.productsService.getSearchFromDb(this.productRef).pipe(
          catchError(error => {
            this.error = 'Error cargando producto';
            console.error(error);
            return of({ productRef: this.productRef, products: [], totalResults: 0 });
          })
        )
      : of({ productRef: '', products: [], totalResults: 0 });

    productFromDb$.pipe(
      catchError(error => {
        this.error = 'Error cargando producto';
        console.error(error);
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((response: any) => {
      const product = response?.products?.find((item: Product) => item.id === this.productId)
        || response?.products?.[0]
        || null;

      if (!product) {
        this.error = 'No pudimos resolver el detalle del producto desde la búsqueda guardada.';
        this.product = null;
        return;
      }

      this.product = product;
      if (product.id) {
        this.refreshAlertState(product.id);
      }
    });
  }

  saveProduct() {
    if (this.product) {
      this.isSaved = !this.isSaved;
      // Aquí irá la lógica para guardar en backend
    }
  }

  createAlert() {
    if (!this.product?.id) {
      return;
    }

    // Si ya existe, manda al panel central para gestionarla.
    if (this.hasAlert) {
      this.router.navigate(['/alerts'], { queryParams: { productId: this.product.id } });
      return;
    }

    if (!this.userRoleService.canUsePremiumFeatures()) {
      // TODO(frontend): confirmar con backend qué capacidades exactas son premium por plan.
      this.premiumBlocked = true;
      this.alertError = 'Función premium bloqueada para tu plan actual';
      return;
    }

    this.premiumBlocked = false;

    this.alertLoading = true;
    this.alertError = null;

    const frequency: AlertFrequency = 'instant';
    this.alertService.createAlertWithoutDuplicate(this.product.id, {
      productId: this.product.id,
      targetPrice: 0,
      currency: 'COP',
      frequency,
      notificationMethod: 'email'
    }).pipe(
      catchError((err) => {
        if (err?.status === 409) {
          this.hasAlert = true;
          return of(null);
        }
        if (err?.status === 403) {
          this.alertError = 'ALERT_LIMIT_REACHED: Alcanzaste el límite de alertas para tu plan';
          return of(null);
        }
        this.alertError = 'No fue posible crear la alerta';
        console.error('Create alert error:', err);
        return of(null);
      }),
      finalize(() => {
        this.alertLoading = false;
      })
    ).subscribe((response) => {
      if (!response) {
        return;
      }

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
    this.alertService.getAlerts(productId).pipe(
      catchError((err) => {
        // No bloquear la vista por esto; solo dejar el estado como "sin alerta".
        console.warn('Error consultando alertas:', err);
        return of({ alerts: [], total: 0, page: 0, pageSize: 0 });
      })
    ).subscribe((response) => {
      this.hasAlert = Array.isArray(response.alerts) && response.alerts.length > 0;
    });
  }
}
