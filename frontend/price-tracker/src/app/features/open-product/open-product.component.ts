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
    <section class="p-8">
      <h2 class="text-xl font-semibold mb-2">Abriendo producto…</h2>
      <p class="text-gray-600" *ngIf="!error">
        Estamos cargando el producto desde tus resultados guardados.
      </p>
      <p class="text-red-700" *ngIf="error">{{ error }}</p>
    </section>
  `
})
export class OpenProductComponent implements OnInit {
  error: string | null = null;
  private loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productsService: ProductsService
  ) {}

  ngOnInit(): void {
    const productRef = this.route.snapshot.queryParamMap.get('productRef') || '';
    const query = this.route.snapshot.queryParamMap.get('query') || '';

    const ref = productRef || query.replace(/\s+/g, '');
    if (!ref) {
      this.error = 'No se recibió un productRef o query para abrir el producto.';
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loading = true;
    this.error = null;

    this.productsService.getSearchFromDb(ref).pipe(
      catchError((err) => {
        console.error('OpenProduct error:', err);
        this.error = 'No fue posible cargar el producto.';
        return of({ productRef: ref, products: [], totalResults: 0 });
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((response) => {
      const product = response.products?.[0];
      if (!product?.id) {
        this.error = 'No se encontró el producto en la base de datos.';
        this.router.navigate(['/dashboard']);
        return;
      }

      // FIX: pasar productRef como queryParam para que ProductDetailComponent
      // pueda buscarlo en la BD sin necesitar un endpoint /products/:id separado.
      this.router.navigate(['/product', product.id], {
        queryParams: { productRef: ref },
        state: { product }   // también pasamos el objeto completo por state para evitar
                              // una segunda llamada a la BD si el componente lo recibe
      });
    });
  }
}