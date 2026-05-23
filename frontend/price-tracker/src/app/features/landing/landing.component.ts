import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TokenService } from '../../core/services/token.service';
import { ProductsService } from '../products/services/products.service';
import { Product } from '../../shared/models/product.model';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit {
  isLoggedIn      = false;
  trendingProducts: Product[] = [];
  trendingLoading = true;

  constructor(
    private router:          Router,
    private tokenService:    TokenService,
    private productsService: ProductsService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.tokenService.hasToken();
    this.loadTrending();
  }

  private loadTrending(): void {
    this.productsService.getTrendingProducts().subscribe({
      next:  (products) => { this.trendingProducts = products.slice(0, 8); this.trendingLoading = false; },
      error: ()         => { this.trendingLoading = false; }
    });
  }

  goToRegister()  { this.router.navigate(['/register']); }
  goToLogin()     { this.router.navigate(['/login']); }
  goToDashboard() { this.router.navigate(['/dashboard']); }
}