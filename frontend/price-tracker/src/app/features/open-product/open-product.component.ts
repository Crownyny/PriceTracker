import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { ProductsService } from '../products/services/products.service';

@Component({
  selector: 'app-open-product',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:80px 24px;text-align:center;color:#6b7280">
      <span *ngIf="!error" style="display:inline-block;width:32px;height:32px;border:3px solid #e5e7eb;border-top-color:#4f46e5;border-radius:50%;animation:spin .7s linear infinite"></span>
      <p *ngIf="!error">Cargando producto…</p>
      <p *ngIf="error" style="color:#b91c1c">{{ error }}</p>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>
  `
})
export class OpenProductComponent implements OnInit {
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productsService: ProductsService
  ) {}

  ngOnInit(): void {
    const productRef = this.route.snapshot.queryParamMap.get('productRef') ?? '';
    const query      = this.route.snapshot.queryParamMap.get('query') ?? '';
    const ref        = productRef || query.replace(/\s+/g, '');

    if (!ref) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.productsService.getSearchFromDb(ref).pipe(
      catchError(() => of({ productRef: ref, products: [], totalResults: 0 })),
    ).subscribe(response => {
      if (!response.products.length) {
        this.error = 'No se encontró el producto en la base de datos.';
        setTimeout(() => this.router.navigate(['/dashboard']), 2000);
        return;
      }

      // Ordenar por precio y tomar el más barato como best
      const sorted = [...response.products].sort((a, b) => a.currentPrice - b.currentPrice);
      const best   = sorted[0];

      // Pasar TODOS los resultados en el state para que product-detail
      // construya la comparación de tiendas sin hacer otra llamada a la BD.
      this.router.navigate(['/product', best.id], {
        queryParams: { productRef: ref },
        state:       { productResult: { best, all: response.products } }
      });
    });
  }
}