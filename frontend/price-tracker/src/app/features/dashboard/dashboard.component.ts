import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductsService } from '../products/services/products.service';
import { AlertService } from '../alerts/services/alert.service';
import { TokenService } from '../../core/services/token.service';
import { Product } from '../../shared/models/product.model';
import { Alert } from '../../shared/models/alert.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  loading = false;
  error = '';
  totalSavings = 0;
  itemsCompared = 0;
  savedProducts: Product[] = [];
  activeAlerts: Alert[] = [];
  bestDeals: any[] = [];
  recentProducts: Product[] = [];

  constructor(
    private productsService: ProductsService,
    private alertService: AlertService,
    private tokenService: TokenService
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.loading = true;

    // Simular datos por ahora
    this.itemsCompared = 24;
    this.totalSavings = 1250;
    this.savedProducts = [];
    this.activeAlerts = [];

    // Mock best deals data
    this.bestDeals = [
      {
        id: '1',
        name: 'Laptop Dell XPS 15',
        category: 'Electrónica',
        image: 'https://via.placeholder.com/300',
        currentPrice: 1299,
        bestPrice: 999,
        savings: 300,
        savingsPercent: 23
      },
      {
        id: '2',
        name: 'Mouse Logitech MX Master',
        category: 'Accesorios',
        image: 'https://via.placeholder.com/300',
        currentPrice: 99,
        bestPrice: 69,
        savings: 30,
        savingsPercent: 30
      },
      {
        id: '3',
        name: 'Monitor LG 27 pulgadas',
        category: 'Monitores',
        image: 'https://via.placeholder.com/300',
        currentPrice: 349,
        bestPrice: 279,
        savings: 70,
        savingsPercent: 20
      },
      {
        id: '4',
        name: 'Teclado Mecánico RGB',
        category: 'Accesorios',
        image: 'https://via.placeholder.com/300',
        currentPrice: 179,
        bestPrice: 129,
        savings: 50,
        savingsPercent: 28
      }
    ];

    this.recentProducts = this.bestDeals.slice(0, 5);
    this.loading = false;
  }
}
