import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-email-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="notifications-container">
      <h2>Configuración de Notificaciones</h2>

      <div class="notification-settings">
        <div class="setting-group">
          <div class="setting-item">
            <label>
              <input 
                type="checkbox" 
                [(ngModel)]="settings.priceDrops"
              />
              <span>Notificar caídas de precio</span>
            </label>
            <p class="description">Recibe alertas cuando baja el precio de productos que sigues</p>
          </div>

          <div class="setting-item">
            <label>
              <input 
                type="checkbox" 
                [(ngModel)]="settings.newProducts"
              />
              <span>Notificar productos nuevos</span>
            </label>
            <p class="description">Recibe alertas de nuevos productos en tus categorías favoritas</p>
          </div>

          <div class="setting-item">
            <label>
              <input 
                type="checkbox" 
                [(ngModel)]="settings.promotions"
              />
              <span>Notificar promociones</span>
            </label>
            <p class="description">Recibe alertas de promociones y ofertas especiales</p>
          </div>

          <div class="setting-item">
            <label>
              <input 
                type="checkbox" 
                [(ngModel)]="settings.restockAlerts"
              />
              <span>Notificar disponibilidad</span>
            </label>
            <p class="description">Recibe alertas cuando se reabastecen productos agotados</p>
          </div>
        </div>

        <div class="frequency-group">
          <h3>Frecuencia de Notificaciones</h3>
          <label>
            <input type="radio" value="immediate" [(ngModel)]="settings.frequency" />
            Inmediata
          </label>
          <label>
            <input type="radio" value="daily" [(ngModel)]="settings.frequency" />
            Diaria
          </label>
          <label>
            <input type="radio" value="weekly" [(ngModel)]="settings.frequency" />
            Semanal
          </label>
        </div>

        <div class="form-actions">
          <button (click)="saveSettings()" class="save-btn">
            Guardar Cambios
          </button>
        </div>
      </div>

      <div *ngIf="message" class="success-message">
        {{ message }}
      </div>
    </div>
  `,
  styles: [`
    .notifications-container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }
    .notification-settings {
      margin-top: 30px;
    }
    .setting-group {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-bottom: 30px;
    }
    .setting-item {
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 4px;
    }
    .setting-item label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      font-weight: bold;
    }
    .setting-item input[type="checkbox"] {
      cursor: pointer;
    }
    .description {
      margin: 10px 0 0 30px;
      color: #666;
      font-size: 14px;
    }
    .frequency-group {
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .frequency-group label {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 10px 0;
      cursor: pointer;
    }
    .form-actions {
      display: flex;
      gap: 10px;
    }
    .save-btn {
      flex: 1;
      padding: 10px 20px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    .success-message {
      padding: 15px;
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
      border-radius: 4px;
      margin-top: 20px;
    }
  `]
})
export class EmailNotificationsComponent implements OnInit {
  message = '';
  settings = {
    priceDrops: true,
    newProducts: true,
    promotions: true,
    restockAlerts: true,
    frequency: 'daily' as const
  };

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    // Aquí iría la lógica para cargar configuración desde el backend
    console.log('Configuración cargada');
  }

  saveSettings() {
    // Aquí iría la lógica para guardar en el backend
    this.message = 'Configuración guardada correctamente';
    setTimeout(() => this.message = '', 3000);
  }
}
