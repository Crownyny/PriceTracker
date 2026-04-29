import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductsService } from '../services/products.service';
import { Product } from '../../../shared/models/product.model';
import { catchError, of } from 'rxjs';

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
  private productId = '';

  constructor(
    private productsService: ProductsService,
    private route: ActivatedRoute
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
      })
    ).subscribe((product: Product | null) => {
      this.product = product;
      this.loading = false;
    });
  }

  saveProduct() {
    if (this.product) {
      this.isSaved = !this.isSaved;
      // Aquí irá la lógica para guardar en backend
    }
  }

  createAlert() {
    // Aquí irá la lógica para crear alertas
    alert('Funcionalidad de alertas próximamente');
  }
}
