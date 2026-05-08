import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TokenService } from '../../core/services/token.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit {
  isLoggedIn = false;

  constructor(
    private router:       Router,
    private tokenService: TokenService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.tokenService.hasToken();
  }

  goToRegister()  { this.router.navigate(['/register']); }
  goToLogin()     { this.router.navigate(['/login']); }
  goToDashboard() { this.router.navigate(['/dashboard']); }
}