import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-documentation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="documentation-container">
      <h2>Documentación de PriceTracker</h2>

      <div class="docs-content">
        <section>
          <h3>¿Qué es PriceTracker?</h3>
          <p>
            PriceTracker es una herramienta que te ayuda a comparar precios en tiempo real
            y encontrar las mejores ofertas disponibles en el mercado.
          </p>
        </section>

        <section>
          <h3>Características Principales</h3>
          <ul>
            <li>Comparación de precios en tiempo real</li>
            <li>Alertas de cambios de precio</li>
            <li>Historial de precios</li>
            <li>Productos guardados</li>
            <li>Notificaciones por email</li>
          </ul>
        </section>

        <section>
          <h3>Cómo Usar</h3>
          <ol>
            <li>Busca un producto en la barra de búsqueda</li>
            <li>Compara precios entre diferentes tiendas</li>
            <li>Crea alertas para los productos que te interesan</li>
            <li>Recibe notificaciones cuando haya cambios importantes</li>
          </ol>
        </section>

        <section>
          <h3>Preguntas Frecuentes</h3>
          <div class="faq-item">
            <h4>¿Es gratis?</h4>
            <p>Sí, PriceTracker es completamente gratuito.</p>
          </div>
          <div class="faq-item">
            <h4>¿Cómo creo una alerta?</h4>
            <p>Ve a los detalles del producto y haz clic en "Crear Alerta".</p>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .documentation-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .docs-content {
      margin-top: 30px;
    }
    section {
      margin-bottom: 30px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 20px;
    }
    section h3 {
      color: #333;
      margin-bottom: 15px;
    }
    ul, ol {
      margin-left: 20px;
      line-height: 1.8;
    }
    .faq-item {
      margin: 15px 0;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    .faq-item h4 {
      margin-top: 0;
      color: #007bff;
    }
  `]
})
export class DocumentationComponent {}
