import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { Product } from '../../../shared/models/product.model';
import { catchError, finalize, of } from 'rxjs';
import { AlertService } from '../../alerts/services/alert.service';
import { AlertFrequency } from '../../../shared/models/alert.model';

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
  private productId = '';

  constructor(
    private productsService: ProductsService,
    private alertService: AlertService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.productId = params['id'];
      this.loadProduct();
    });
  }

  loadProduct() {
    this.loading = true;
    this.productsService.getProduct(this.productId).pipe(
      catchError(error => {
        this.error = 'Error cargando producto';
        console.error(error);
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((product: Product | null) => {
      this.product = product;
      if (product?.id) {
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

    this.alertLoading = true;
    this.alertError = null;

    const frequency: AlertFrequency = 'instant';
    this.alertService.createAlert(this.product.id, {
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
      this.hasAlert = true;
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
