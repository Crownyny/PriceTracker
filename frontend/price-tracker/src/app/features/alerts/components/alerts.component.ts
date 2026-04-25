import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AlertService } from '../services/alert.service';
import { Alert, AlertFrequency } from '../../../shared/models/alert.model';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="alerts-container">
      <header>
        <h2>Gestionar Alertas de Precios</h2>
        <p>Recibe notificaciones cuando los precios bajen</p>
      </header>

      <div class="form-group filter-group">
        <label>Producto a consultar:</label>
        <div class="filter-row">
          <input [(ngModel)]="selectedProductId" name="selectedProductId" placeholder="Ingresa productId" />
          <button class="btn-secondary" (click)="loadAlerts()">Listar alertas</button>
        </div>
      </div>

      <!-- Create Alert Button -->
      <button (click)="toggleCreateForm()" class="btn-primary">
        {{ showCreateForm ? 'Cancelar' : '+ Crear Nueva Alerta' }}
      </button>

      <!-- Create Alert Form -->
      <div *ngIf="showCreateForm" class="alert-form">
        <h3>Nueva Alerta</h3>
        <form (ngSubmit)="createAlert()">
          <div class="form-group">
            <label>ID del Producto:</label>
            <input [(ngModel)]="newAlert.productId" name="productId" placeholder="Ingresa el ID del producto" />
          </div>

          <div class="form-group">
            <label>Precio Objetivo:</label>
            <input type="number" [(ngModel)]="newAlert.targetPrice" name="targetPrice" placeholder="Ingresa el precio" />
          </div>

          <div class="form-group">
            <label>Moneda:</label>
            <select [(ngModel)]="newAlert.currency" name="currency">
              <option value="USD">USD</option>
              <option value="MXN">MXN</option>
              <option value="COP">COP</option>
            </select>
          </div>

          <div class="form-group">
            <label>Frecuencia:</label>
            <select [(ngModel)]="newAlert.frequency" name="frequency">
              <option value="D1">Diaria</option>
              <option value="W1">Semanal</option>
              <option value="ALL">Cada cambio</option>
            </select>
          </div>

          <div class="form-group">
            <label>Método de Notificación:</label>
            <select [(ngModel)]="newAlert.notificationMethod" name="notificationMethod">
              <option value="email">Email</option>
              <option value="push">Push</option>
              <option value="both">Ambos</option>
            </select>
          </div>

          <button type="submit" class="btn-primary" [disabled]="submitting">
            {{ submitting ? 'Creando...' : 'Crear Alerta' }}
          </button>
        </form>
      </div>

      <!-- Alerts List -->
      <div class="alerts-list">
        <h3>Mis Alertas ({{ alerts.length }})</h3>

        <div *ngIf="alerts.length === 0" class="empty-state">
          <p>No tienes alertas creadas. ¡Crea una para empezar!</p>
        </div>

        <div *ngFor="let alert of alerts" class="alert-card" [class.inactive]="!alert.isActive">
          <div class="alert-header">
            <div class="alert-info">
              <h4>{{ alert.productRef }}</h4>
              <p class="alert-target">Precio objetivo: {{ alert.targetPrice | currency: alert.currency }}</p>
            </div>
            <div class="alert-status">
              <span [class]="alert.isActive ? 'badge-active' : 'badge-inactive'">
                {{ alert.isActive ? '🔔 Activa' : '🔕 Inactiva' }}
              </span>
            </div>
          </div>

          <div class="alert-details">
            <span>Frecuencia: <strong>{{ getFrequencyLabel(alert.frequency) }}</strong></span>
            <span>Notificación: <strong>{{ alert.notificationMethod }}</strong></span>
            <span *ngIf="alert.lastNotified">Última: {{ alert.lastNotified | date: 'short' }}</span>
          </div>

          <div class="alert-actions">
            <button 
              (click)="toggleAlertStatus(alert)"
              [class.btn-danger]="alert.isActive"
              [class.btn-success]="!alert.isActive"
            >
              {{ alert.isActive ? 'Desactivar' : 'Activar' }}
            </button>
            <button (click)="editAlert(alert)" class="btn-secondary">
              Editar
            </button>
            <button (click)="deleteAlert(alert.id, alert.productId)" class="btn-danger">
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading">
        Cargando alertas...
      </div>

      <!-- Error -->
      <div *ngIf="error" class="error">
        {{ error }}
      </div>
    </div>
  `,
  styleUrl: './alerts.component.css'
})
export class AlertsComponent implements OnInit {
  alerts: Alert[] = [];
  selectedProductId: string = '';
  showCreateForm: boolean = false;
  loading: boolean = true;
  error: string | null = null;
  submitting: boolean = false;

  newAlert = {
    productId: '',
    targetPrice: 0,
    currency: 'USD',
    frequency: 'D1' as AlertFrequency,
    notificationMethod: 'email' as const
  };

  constructor(
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loading = false;
  }

  loadAlerts(): void {
    if (!this.selectedProductId.trim()) {
      this.error = 'Debes indicar un productId para listar alertas';
      return;
    }

    this.loading = true;
    this.error = null;

    this.alertService.getAlerts(this.selectedProductId, 'ALL').subscribe({
      next: (response) => {
        this.alerts = response.alerts;
      },
      error: (err) => {
        console.error('Error cargando alertas:', err);
        this.error = 'Error al cargar las alertas';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) {
      this.resetForm();
    }
  }

  createAlert(): void {
    if (!this.newAlert.productId || this.newAlert.targetPrice <= 0) {
      this.error = 'Completa todos los campos';
      return;
    }

    this.submitting = true;

    this.alertService.createAlert(this.newAlert.productId, {
      productId: this.newAlert.productId,
      targetPrice: this.newAlert.targetPrice,
      currency: this.newAlert.currency,
      frequency: this.newAlert.frequency,
      notificationMethod: this.newAlert.notificationMethod
    }).subscribe({
      next: (response) => {
        this.selectedProductId = this.newAlert.productId;
        this.alerts.push(response.alert as Alert);
        this.resetForm();
        this.showCreateForm = false;
        this.error = null;
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.error = 'ALERT_ALREADY_EXISTS: Ya existe una alerta activa para este producto';
          return;
        }

        if (err.status === 403) {
          this.error = 'ALERT_LIMIT_REACHED: Alcanzaste el limite de alertas para tu plan';
          return;
        }

        this.error = 'Error al crear la alerta';
      },
      complete: () => {
        this.submitting = false;
      }
    });
  }

  toggleAlertStatus(alert: Alert): void {
    this.alertService.updateAlertStatus(alert.productId, {
      isActive: !alert.isActive
    }).subscribe({
      next: () => {
        alert.isActive = !alert.isActive;
      },
      error: (err) => {
        this.error = 'Error al cambiar estado de la alerta';
      }
    });
  }

  editAlert(alert: Alert): void {
    this.alertService.updateAlert(alert.productId, {
      frequency: alert.frequency
    }).subscribe({
      next: () => {
        this.error = null;
      },
      error: () => {
        this.error = 'Error al editar la alerta';
      }
    });
  }

  deleteAlert(alertId: string, productId: string): void {
    if (confirm('¿Estás seguro de que deseas eliminar esta alerta?')) {
      this.alertService.deleteAlert(productId).subscribe({
        next: () => {
          this.alerts = this.alerts.filter(a => a.id !== alertId);
        },
        error: (err) => {
          this.error = 'Error al eliminar la alerta';
        }
      });
    }
  }

  getFrequencyLabel(frequency: string): string {
    const labels: { [key: string]: string } = {
      'D1': 'Diaria',
      'W1': 'Semanal',
      'ALL': 'Cada cambio'
    };
    return labels[frequency] || frequency;
  }

  private resetForm(): void {
    this.newAlert = {
      productId: '',
      targetPrice: 0,
      currency: 'USD',
      frequency: 'D1',
      notificationMethod: 'email'
    };
  }
}
