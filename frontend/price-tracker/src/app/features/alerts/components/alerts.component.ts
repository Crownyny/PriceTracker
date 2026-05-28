import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../services/alert.service';
import { Alert, AlertFrequency } from '../../../shared/models/alert.model';
import { UserRoleService } from '../../../core/services/user-role.service';
import { ProductsService } from '../../products/services/products.service';
import { Product } from '../../../shared/models/product.model';
import { catchError, debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getFrequencyLabel } from '../../../shared/utils/alert.utils';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.css'
})
export class AlertsComponent implements OnInit {

  alerts: Alert[] = [];
  productNames:  Record<string, string> = {};
  productImages: Record<string, string> = {};
  productPrices: Record<string, number>  = {};
  loading = false;
  error: string | null = null;
  isPremium = false;

  modalOpen = false;
  modalMode: 'create' | 'manage' = 'create';
  modalProduct: Product | null = null;
  modalExistingAlert: Alert | null = null;
  modalFrequency: AlertFrequency = 'instant';
  modalSubmitting = false;
  modalError: string | null = null;
  modalSuccess: string | null = null;

  productSearchQuery = '';
  productSearchResults: Product[] = [];
  productSearchLoading = false;
  productSearchError: string | null = null;
  productSearchDone = false;

  private readonly destroyRef = inject(DestroyRef);
  private searchSubject = new Subject<string>();

  constructor(
    private alertService:    AlertService,
    private userRoleService: UserRoleService,
    private productsService: ProductsService,
    private route:  ActivatedRoute,
    private router: Router,
    private cdr:    ChangeDetectorRef
  ) {
    // Debounce de búsqueda de productos
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap((query) => {
        const q = query.trim().replace(/\s+/g, '').toLowerCase();
        if (!q) {
          this.productSearchResults = [];
          this.productSearchDone = false;
          return of({ productRef: '', products: [], totalResults: 0 });
        }
        this.productSearchLoading = true;
        this.productSearchError = null;
        return this.productsService.getSearchFromDb(q).pipe(
          catchError(() => {
            this.productSearchError = 'Error buscando productos. Intenta de nuevo.';
            return of({ productRef: q, products: [], totalResults: 0 });
          })
        );
      }),
      takeUntilDestroyed()
    ).subscribe((response) => {
      this.productSearchResults = response.products;
      this.productSearchLoading = false;
      this.productSearchDone = true;
    });
  }

  ngOnInit(): void {
    this.isPremium = this.userRoleService.canUsePremiumFeatures();
    this.userRoleService.fetchAndSyncRole()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(role => {
        this.isPremium = role === 'premium';
        this.cdr.markForCheck();
      });
    this.loadAlerts();

    // Si viene ?productId=... desde otra pantalla, pre-seleccionar ese producto
    const preselectedId = this.route.snapshot.queryParamMap.get('productId');
    if (preselectedId) {
      this.openCreateModalWithProductId(preselectedId);
    }
  }

  // ── Carga de alertas ───────────────────────────────────────────────────────

  loadAlerts(): void {
    this.loading = true;
    this.error = null;
    this.alertService.getAlerts().subscribe({
      next: (response) => {
        this.alerts = response.alerts;
        this.loading = false;
        this.resolveProductNames(response.alerts);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Error al cargar las alertas.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private resolveProductNames(alerts: Alert[]): void {
    for (const alert of alerts) {
      if (!alert.productId || this.productNames[alert.productId]) continue;

      this.productNames[alert.productId] = alert.productRef || alert.productId.slice(0, 8) + '…';

      this.productsService.resolveProductName(alert.productId).subscribe(name => {
        this.productNames[alert.productId] = name;
        this.cdr.markForCheck();
      });

      const cached = this.productsService.getCachedProduct(alert.productId);
      if (cached) {
        if (cached.image) this.productImages[alert.productId] = cached.image;
        if (cached.currentPrice) this.productPrices[alert.productId] = cached.currentPrice;
      } else {
        this.productsService.getProduct(alert.productId).pipe(
          catchError(() => of(null))
        ).subscribe(product => {
          if (product?.image)        this.productImages[alert.productId] = product.image;
          if (product?.currentPrice) this.productPrices[alert.productId] = product.currentPrice;
          this.cdr.markForCheck();
        });
      }
    }
  }

  // ── Apertura del modal ─────────────────────────────────────────────────────

  openCreateModal(): void {
    this.modalMode = 'create';
    this.modalProduct = null;
    this.modalExistingAlert = null;
    this.modalFrequency = 'instant';
    this.modalError = null;
    this.modalSuccess = null;
    this.productSearchQuery = '';
    this.productSearchResults = [];
    this.productSearchDone = false;
    this.modalOpen = true;
  }

  openManageModal(alert: Alert): void {
    // Usar el nombre ya resuelto del producto si está disponible
    const resolvedName = this.productNames[alert.productId] || alert.productRef || alert.productId;
    this.modalProduct = {
      id:           alert.productId,
      productRef:   alert.productRef ?? alert.productId,
      name:         resolvedName,
      image:        this.productImages[alert.productId],
      currentPrice: this.productPrices[alert.productId] ?? alert.targetPrice ?? 0,
      currency:     alert.currency ?? 'COP',
      availability: true
    };
    this.modalExistingAlert = alert;
    this.modalFrequency = alert.frequency;
    this.modalMode = 'manage';
    this.modalError = null;
    this.modalSuccess = null;
    this.modalOpen = true;
  }

  private openCreateModalWithProductId(productId: string): void {
    this.productsService.getProduct(productId).pipe(
      catchError(() => of(null))
    ).subscribe((product) => {
      if (!product) {
        this.openCreateModal();
        return;
      }
      this.alertService.findAlertByProductId(productId).pipe(
        catchError(() => of(null))
      ).subscribe((existing) => {
        if (existing) {
          this.openManageModal(existing);
        } else {
          this.selectProduct(product);
          this.modalOpen = true;
        }
      });
    });
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalProduct = null;
    this.modalExistingAlert = null;
    this.modalError = null;
    this.modalSuccess = null;
    this.productSearchQuery = '';
    this.productSearchResults = [];
    this.productSearchDone = false;
  }

  // ── Búsqueda de productos en el modal ─────────────────────────────────────

  onProductSearch(): void {
    this.searchSubject.next(this.productSearchQuery);
  }

  selectProduct(product: Product): void {
    this.modalProduct = product;
    this.modalMode = 'create';
    this.modalFrequency = 'instant';
    this.modalError = null;
    this.modalSuccess = null;
    this.productSearchQuery = '';
    this.productSearchResults = [];
    this.productSearchDone = false;

    this.alertService.findAlertByProductId(product.id).pipe(
      catchError(() => of(null))
    ).subscribe((existing) => {
      if (existing) {
        this.modalExistingAlert = existing;
        this.modalMode = 'manage';
        this.modalFrequency = existing.frequency;
      }
    });
  }

  clearSelectedProduct(): void {
    this.modalProduct = null;
    this.modalExistingAlert = null;
    this.modalMode = 'create';
    this.productSearchQuery = '';
    this.productSearchResults = [];
    this.productSearchDone = false;
  }

  // ── Crear alerta ───────────────────────────────────────────────────────────

  submitCreateAlert(): void {
    if (!this.modalProduct?.id) {
      this.modalError = 'Selecciona un producto primero.';
      return;
    }

    if (this.modalFrequency === 'weekly' && !this.isPremium) {
      this.modalError = 'La frecuencia semanal requiere plan Premium.';
      this.cdr.markForCheck();
      return;
    }

    // Validación frontend del límite freemium (3 alertas activas)
    if (!this.isPremium) {
      const FREE_ALERT_LIMIT = 3;
      const activeCount = this.alerts.filter(a => a.isActive !== false).length;
      if (activeCount >= FREE_ALERT_LIMIT) {
        this.modalError = 'UPGRADE_REQUIRED';
        this.cdr.markForCheck();
        return;
      }
    }

    this.modalSubmitting = true;
    this.modalError = null;

    this.alertService.createAlertWithoutDuplicate(this.modalProduct.id, {
      frequency: this.modalFrequency
    }).subscribe({
      next: (response) => {
        this.modalSubmitting = false;
        if (response.message === 'ALERT_ALREADY_EXISTS') {
          this.modalSuccess = 'Ya tenías una alerta para este producto.';
          if (response.alert) {
            this.modalExistingAlert = response.alert;
            this.modalMode = 'manage';
            this.modalFrequency = response.alert.frequency;
            this.syncAlertInList(response.alert);
          }
        } else {
          this.modalSuccess = '¡Alerta creada exitosamente!';
          if (response.alert) {
            this.alerts = [response.alert, ...this.alerts];
            this.modalExistingAlert = response.alert;
            this.modalMode = 'manage';
          }
        }
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.modalSubmitting = false;
        if (err.status === 409) {
          this.modalError = 'Ya existe una alerta para este producto.';
        } else if (
          err.status === 403 ||
          (err.status === 400 &&
            String(err?.error?.message ?? '').toLowerCase().includes('maximum'))
        ) {
          // Backend devuelve 400 con "Maximum number of alerts reached for freemium users"
          this.modalError = this.isPremium
            ? 'Límite de alertas alcanzado. Contacta soporte si crees que es un error.'
            : 'Alcanzaste el límite de 3 alertas del plan gratuito. Ve a Mi Cuenta para actualizar a Premium.';
        } else {
          this.modalError = 'Error al crear la alerta. Intenta de nuevo.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  // ── Gestionar alerta existente ─────────────────────────────────────────────

  toggleAlertStatus(): void {
    if (!this.modalExistingAlert) return;
    const newStatus = !this.modalExistingAlert.isActive;
    this.alertService.updateAlertStatus(this.modalExistingAlert.id, { isActive: newStatus }).subscribe({
      next: () => {
        this.modalExistingAlert!.isActive = newStatus;
        this.syncAlertInList(this.modalExistingAlert!);
        this.modalSuccess = newStatus ? 'Alerta activada.' : 'Alerta pausada.';
        this.modalError = null;
        this.cdr.markForCheck();
      },
      error: () => { this.modalError = 'Error al cambiar estado de la alerta.'; this.cdr.markForCheck(); }
    });
  }

  updateFrequency(): void {
    if (!this.modalExistingAlert) return;
    if (this.modalFrequency === 'weekly' && !this.isPremium) {
      this.modalError = 'La frecuencia semanal requiere plan Premium.';
      return;
    }
    this.alertService.updateAlert(this.modalExistingAlert.id, {
      frequency: this.modalFrequency
    }).subscribe({
      next: () => {
        this.modalExistingAlert!.frequency = this.modalFrequency;
        this.syncAlertInList(this.modalExistingAlert!);
        this.modalSuccess = 'Frecuencia actualizada.';
        this.modalError = null;
        this.cdr.markForCheck();
      },
      error: () => { this.modalError = 'Error al actualizar la frecuencia.'; this.cdr.markForCheck(); }
    });
  }

  deleteAlert(): void {
    if (!this.modalExistingAlert || !confirm('¿Eliminar esta alerta?')) return;
    this.alertService.deleteAlert(this.modalExistingAlert.id).subscribe({
      next: () => {
        this.alerts = this.alerts.filter(a => a.id !== this.modalExistingAlert!.id);
        this.modalSuccess = 'Alerta eliminada.';
        this.cdr.markForCheck();
        setTimeout(() => this.closeModal(), 900);
      },
      error: () => { this.modalError = 'Error al eliminar la alerta.'; this.cdr.markForCheck(); }
    });
  }

  // ── Acciones directas en la lista (fuera del modal) ───────────────────────

  toggleAlertInList(alert: Alert): void {
    this.alertService.updateAlertStatus(alert.id, { isActive: !alert.isActive }).subscribe({
      next: () => { alert.isActive = !alert.isActive; this.cdr.markForCheck(); },
      error: () => { this.error = 'Error al cambiar estado.'; this.cdr.markForCheck(); }
    });
  }

  deleteAlertInList(alertId: string): void {
    if (!confirm('¿Eliminar esta alerta?')) return;
    this.alertService.deleteAlert(alertId).subscribe({
      next: () => { this.alerts = this.alerts.filter(a => a.id !== alertId); this.cdr.markForCheck(); },
      error: () => { this.error = 'Error al eliminar la alerta.'; this.cdr.markForCheck(); }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  readonly getFrequencyLabel = getFrequencyLabel;

  setModalFrequency(value: string): void {
    if (value === 'instant' || value === 'daily' || value === 'weekly') {
      this.modalFrequency = value;
    }
  }

  private syncAlertInList(alert: Alert): void {
    const idx = this.alerts.findIndex(a => a.id === alert.id);
    if (idx !== -1) {
      this.alerts[idx] = { ...alert };
    }
  }

  goToProduct(alert: Alert): void {
    const productRef = alert.productRef || this.productNames[alert.productId] || '';
    this.router.navigate(['/product', alert.productId], {
      queryParams: productRef ? { productRef } : {}
    });
  }
}