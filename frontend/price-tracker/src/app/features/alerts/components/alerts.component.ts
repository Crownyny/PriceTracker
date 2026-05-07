import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AlertService } from '../services/alert.service';
import { Alert, AlertFrequency } from '../../../shared/models/alert.model';
import { UserRoleService } from '../../../core/services/user-role.service';
import { ProductsService } from '../../products/services/products.service';
import { Product } from '../../../shared/models/product.model';
import { catchError, debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.css'
})
export class AlertsComponent implements OnInit {

  // ── Estado de alertas ──────────────────────────────────────────────────────
  alerts: Alert[] = [];
  productNames: Record<string, string> = {};
  loading = false;
  error: string | null = null;
  isPremium = false;

  // ── Modal crear/gestionar alerta ───────────────────────────────────────────
  modalOpen = false;
  modalMode: 'create' | 'manage' = 'create';
  modalProduct: Product | null = null;
  modalExistingAlert: Alert | null = null;
  modalFrequency: AlertFrequency = 'instant';
  modalSubmitting = false;
  modalError: string | null = null;
  modalSuccess: string | null = null;

  // ── Búsqueda de productos (para crear alerta) ─────────────────────────────
  productSearchQuery = '';
  productSearchResults: Product[] = [];
  productSearchLoading = false;
  productSearchError: string | null = null;
  productSearchDone = false;

  private searchSubject = new Subject<string>();

  constructor(
    private alertService: AlertService,
    private userRoleService: UserRoleService,
    private productsService: ProductsService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
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

  /** Resuelve en paralelo el nombre de cada producto — sin bloquear la UI */
  private resolveProductNames(alerts: Alert[]): void {
    for (const alert of alerts) {
      if (!alert.productId || this.productNames[alert.productId]) continue;
      // Placeholder inmediato
      this.productNames[alert.productId] = alert.productRef || alert.productId.slice(0, 8) + '…';
      // Resolver nombre real en segundo plano
      this.productsService.resolveProductName(alert.productId).subscribe(name => {
        this.productNames[alert.productId] = name;
      });
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
    // Construir un Product mínimo desde la alerta para mostrar en el modal
    this.modalProduct = {
      id: alert.productId,
      productRef: alert.productRef ?? alert.productId,
      name: alert.productRef ?? alert.productId,
      currentPrice: alert.targetPrice ?? 0,
      currency: alert.currency ?? 'COP',
      availability: true
    };
    this.modalExistingAlert = alert;
    this.modalFrequency = alert.frequency;
    this.modalMode = 'manage';
    this.modalError = null;
    this.modalSuccess = null;
    this.modalOpen = true;
  }

  /** Cuando viene un productId por queryParam (flujo desde Dashboard / ProductDetail) */
  private openCreateModalWithProductId(productId: string): void {
    this.productsService.getProduct(productId).pipe(
      catchError(() => of(null))
    ).subscribe((product) => {
      if (!product) {
        // Si no se puede resolver el producto, abrir modal vacío con búsqueda
        this.openCreateModal();
        return;
      }
      // Ver si ya existe alerta para ese producto
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

    // Verificar si ya existe alerta para este producto
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
      return;
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
      },
      error: (err: HttpErrorResponse) => {
        this.modalSubmitting = false;
        if (err.status === 409) {
          this.modalError = 'Ya existe una alerta para este producto.';
        } else if (err.status === 403) {
          this.modalError = this.isPremium ? 'Límite de alertas alcanzado. Contacta soporte.' : 'UPGRADE_REQUIRED';
        } else {
          this.modalError = 'Error al crear la alerta. Intenta de nuevo.';
        }
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

  getFrequencyLabel(frequency: string): string {
    const labels: Record<string, string> = {
      instant: 'Inmediata', daily: 'Diaria', weekly: 'Semanal'
    };
    return labels[frequency] ?? frequency;
  }

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
}